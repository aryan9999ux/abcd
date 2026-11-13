import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../supabase/admin";
import { getSpot } from "../market/server-feed";
import { marginRequired, priceInstrument } from "../market/pricing";
import { instrumentKey, parseInstrumentKey, type CheckoutRequest, type InstrumentRef, type OrderType, type PlaceOrderRequest, type Side } from "../types";
import { HttpError } from "./http";
import { withLock } from "./lock";
import {
  classifyOrder, evaluateRisk, hasMargin, increasingQty, isTriggered, istDate, netFill, opposite,
  round2, strikeInRange, unrealized, validateInstrument, type Breach, type PositionState,
} from "./pure";

/*
 * Concurrency note: every write for an account runs inside an in-process lock (lock.ts) and the writes are
 * sequential REST calls, not one database transaction. That is correct for a single engine instance. Before running
 * more than one instance, move recordFill into a Postgres function so the position, trade and balance change atomically.
 */

const MAX_PENDING_ORDERS = 50;
const MAX_ACCOUNTS_PER_USER = 20;
const SNAPSHOT_EVERY_MS = 60_000;

type Sb = SupabaseClient;

export function admin(): Sb {
  try {
    return adminClient();
  } catch {
    throw new HttpError(503, "The trading engine is not configured yet (SUPABASE_SERVICE_ROLE_KEY is missing).");
  }
}

/** Unwrap a Supabase result. Rows are untyped here (no generated types), so callers coerce numerics themselves. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function must(res: { data: any; error: { message: string } | null }, what: string): any {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

interface AccountRow {
  id: string; user_id: string; plan_key: string; account_size: number; phase: string; status: string;
  balance: number; day_start_equity: number; trading_days: number; day_start_date: string | null;
  last_trading_date: string | null; breach_reason: string | null;
}
interface PosRow { id: string; instrument: string; segment: string; side: Side; qty: number; avg_price: number }
interface Ctx { sb: Sb; acct: AccountRow; maxDailyPct: number; maxOverallPct: number; positions: PosRow[]; now: number }

const num = (v: unknown) => Number(v);
function toAccount(r: Record<string, unknown>): AccountRow {
  return {
    id: String(r.id), user_id: String(r.user_id), plan_key: String(r.plan_key), account_size: num(r.account_size),
    phase: String(r.phase), status: String(r.status), balance: num(r.balance), day_start_equity: num(r.day_start_equity),
    trading_days: num(r.trading_days), day_start_date: (r.day_start_date as string) ?? null,
    last_trading_date: (r.last_trading_date as string) ?? null, breach_reason: (r.breach_reason as string) ?? null,
  };
}

async function loadCtx(sb: Sb, accountId: string, userId?: string): Promise<Ctx> {
  let q = sb.from("trading_accounts").select("*").eq("id", accountId);
  if (userId) q = q.eq("user_id", userId);
  const row = must(await q.maybeSingle(), "load account");
  if (!row) throw new HttpError(404, "Account not found.");
  const acct = toAccount(row);
  const plan = must(await sb.from("plans").select("max_daily_loss_pct,max_overall_loss_pct").eq("key", acct.plan_key).single(), "load plan");
  const pos = must(await sb.from("positions").select("id,instrument,segment,side,qty,avg_price").eq("account_id", accountId), "load positions");
  const positions = (pos ?? []).map((p: Record<string, unknown>) => ({ ...p, qty: num(p.qty), avg_price: num(p.avg_price) })) as PosRow[];
  return { sb, acct, maxDailyPct: num(plan.max_daily_loss_pct), maxOverallPct: num(plan.max_overall_loss_pct), positions, now: Date.now() };
}

/* ---------- pricing the book ---------- */

function spotFor(ref: InstrumentRef): number {
  const s = getSpot(ref.underlying);
  if (s == null) throw new HttpError(503, `No price for ${ref.underlying} right now. Try again in a moment.`);
  return s;
}

function book(ctx: Ctx) {
  let upl = 0, used = 0;
  for (const p of ctx.positions) {
    const ref = parseInstrumentKey(p.instrument);
    const spot = spotFor(ref);
    const mark = priceInstrument(ref, spot, ctx.now);
    upl += unrealized({ side: p.side, qty: p.qty, avg: p.avg_price }, mark);
    used += marginRequired(ref, p.side, p.qty, p.avg_price, spot);
  }
  return { equity: round2(ctx.acct.balance + upl), used: round2(used) };
}

/* ---------- writes ---------- */

async function insertOrder(ctx: Ctx, o: {
  ref: InstrumentRef; side: Side; type: OrderType; qty: number; price: number | null;
  status: "pending" | "filled" | "rejected"; reason?: string;
}): Promise<string> {
  const row = must(await ctx.sb.from("orders").insert({
    user_id: ctx.acct.user_id, account_id: ctx.acct.id, instrument: instrumentKey(o.ref), segment: o.ref.segment,
    underlying: o.ref.underlying, strike: o.ref.strike ?? null, expiry: o.ref.expiry ?? null, side: o.side,
    order_type: o.type, qty: o.qty, price: o.price, status: o.status, reject_reason: o.reason ?? null,
    filled_at: o.status === "filled" ? new Date(ctx.now).toISOString() : null,
  }).select("id").single(), "insert order");
  return row.id as string;
}

/** Apply one fill: order row, trade, position (net/average/flip) and account balance. */
async function recordFill(ctx: Ctx, f: {
  ref: InstrumentRef; side: Side; qty: number; price: number; type: OrderType; orderId?: string;
}): Promise<string> {
  const key = instrumentKey(f.ref);
  const existing = ctx.positions.find((p) => p.instrument === key);
  const state: PositionState | null = existing ? { side: existing.side, qty: existing.qty, avg: existing.avg_price } : null;
  const { next, realized } = netFill(state, f.side, f.qty, f.price);

  let orderId = f.orderId;
  if (orderId) {
    must(await ctx.sb.from("orders").update({ status: "filled", filled_at: new Date(ctx.now).toISOString() }).eq("id", orderId), "fill order");
  } else {
    orderId = await insertOrder(ctx, { ref: f.ref, side: f.side, type: f.type, qty: f.qty, price: f.price, status: "filled" });
  }
  must(await ctx.sb.from("trades").insert({
    user_id: ctx.acct.user_id, account_id: ctx.acct.id, order_id: orderId, instrument: key, side: f.side,
    qty: f.qty, price: f.price, realized_pnl: realized,
  }), "insert trade");

  if (existing && next) {
    must(await ctx.sb.from("positions").update({ side: next.side, qty: next.qty, avg_price: next.avg }).eq("id", existing.id), "update position");
    Object.assign(existing, { side: next.side, qty: next.qty, avg_price: next.avg });
  } else if (existing) {
    must(await ctx.sb.from("positions").delete().eq("id", existing.id), "delete position");
    ctx.positions = ctx.positions.filter((p) => p !== existing);
  } else if (next) {
    const row = must(await ctx.sb.from("positions").insert({
      user_id: ctx.acct.user_id, account_id: ctx.acct.id, instrument: key, segment: f.ref.segment,
      side: next.side, qty: next.qty, avg_price: next.avg,
    }).select("id").single(), "insert position");
    ctx.positions.push({ id: row.id as string, instrument: key, segment: f.ref.segment, side: next.side, qty: next.qty, avg_price: next.avg });
  }

  const today = istDate(ctx.now);
  const newDay = ctx.acct.last_trading_date !== today;
  const patch = {
    balance: round2(ctx.acct.balance + realized),
    trading_days: ctx.acct.trading_days + (newDay ? 1 : 0),
    last_trading_date: today,
  };
  must(await ctx.sb.from("trading_accounts").update(patch).eq("id", ctx.acct.id), "update account");
  Object.assign(ctx.acct, patch);
  return orderId;
}

const snapAt = ((globalThis as unknown as { __propSnap?: Map<string, number> }).__propSnap ??= new Map());
async function snapshot(ctx: Ctx, force: boolean) {
  if (!force && ctx.now - (snapAt.get(ctx.acct.id) ?? 0) < SNAPSHOT_EVERY_MS) return;
  snapAt.set(ctx.acct.id, ctx.now);
  const { equity } = book(ctx);
  must(await ctx.sb.from("equity_snapshots").insert({ user_id: ctx.acct.user_id, account_id: ctx.acct.id, equity }), "equity snapshot");
}

async function rollDay(ctx: Ctx) {
  const today = istDate(ctx.now);
  if (ctx.acct.day_start_date === today) return;
  const { equity } = book(ctx);
  const patch = { day_start_equity: equity, day_start_date: today };
  must(await ctx.sb.from("trading_accounts").update(patch).eq("id", ctx.acct.id), "roll day");
  Object.assign(ctx.acct, patch);
}

const BREACH_TEXT: Record<Breach, string> = {
  overall_loss_limit: "Overall loss limit reached",
  daily_loss_limit: "Daily loss limit reached",
};

async function squareOff(ctx: Ctx, breach: Breach) {
  must(await ctx.sb.from("orders").update({ status: "cancelled", reject_reason: BREACH_TEXT[breach] })
    .eq("account_id", ctx.acct.id).eq("status", "pending"), "cancel pending");
  for (const p of [...ctx.positions]) {
    const ref = parseInstrumentKey(p.instrument);
    const px = priceInstrument(ref, spotFor(ref), ctx.now);
    await recordFill(ctx, { ref, side: opposite(p.side), qty: p.qty, price: px, type: "Market" });
  }
  const patch = { status: "breached", breach_reason: BREACH_TEXT[breach] };
  must(await ctx.sb.from("trading_accounts").update(patch).eq("id", ctx.acct.id), "breach account");
  Object.assign(ctx.acct, patch);
  await snapshot(ctx, true);
}

/** Check loss limits against the live book; square off and close the account on a breach. */
async function enforceRisk(ctx: Ctx): Promise<boolean> {
  const { equity } = book(ctx);
  const r = evaluateRisk({
    accountSize: ctx.acct.account_size, dayStartEquity: ctx.acct.day_start_equity, equity,
    maxDailyPct: ctx.maxDailyPct, maxOverallPct: ctx.maxOverallPct,
  });
  if (!r.breach) return false;
  await squareOff(ctx, r.breach);
  return true;
}

/* ---------- public operations ---------- */

function refOf(req: { underlying: string; segment: InstrumentRef["segment"]; strike?: number | null; expiry?: string | null }): InstrumentRef {
  return { underlying: req.underlying, segment: req.segment, strike: req.strike ?? undefined, expiry: req.expiry ?? undefined };
}

function requireActive(ctx: Ctx) {
  if (ctx.acct.status !== "active") throw new HttpError(403, ctx.acct.breach_reason ? `This account is closed: ${ctx.acct.breach_reason}.` : `This account is ${ctx.acct.status}.`);
}

export async function placeOrder(userId: string, req: PlaceOrderRequest) {
  return withLock(req.accountId, async () => {
    const ctx = await loadCtx(admin(), req.accountId, userId);
    requireActive(ctx);
    const ref = refOf(req);
    const bad = validateInstrument(ref, req.qty, ctx.now);
    if (bad) throw new HttpError(400, bad);
    const spot = spotFor(ref);
    if (ref.strike != null && !strikeInRange(ref.strike, spot)) throw new HttpError(400, "That strike is too far from the current price.");
    await rollDay(ctx);

    const ltp = priceInstrument(ref, spot, ctx.now);
    const limit = req.orderType === "Market" ? undefined : (req.price ?? undefined);
    const action = classifyOrder(req.orderType, req.side, limit, ltp);
    if (action === "invalid") {
      throw new HttpError(400, limit == null ? "Enter a price for this order." : "A stop order must be placed beyond the current price.");
    }

    const key = instrumentKey(ref);
    const ex = ctx.positions.find((p) => p.instrument === key);
    const inc = increasingQty(ex ? { side: ex.side, qty: ex.qty, avg: ex.avg_price } : null, req.side, req.qty);
    const estPx = action === "fill" ? ltp : (limit as number);
    const need = inc > 0 ? marginRequired(ref, req.side, inc, estPx, spot) : 0;
    const b = book(ctx);
    if (!hasMargin(need, b.equity, b.used)) {
      const reason = `Not enough margin. Needs ₹${Math.ceil(need).toLocaleString("en-IN")}, available ₹${Math.max(0, Math.floor(b.equity - b.used)).toLocaleString("en-IN")}.`;
      await insertOrder(ctx, { ref, side: req.side, type: req.orderType, qty: req.qty, price: limit ?? null, status: "rejected", reason });
      throw new HttpError(422, reason);
    }

    if (action === "pending") {
      const { count } = await ctx.sb.from("orders").select("id", { count: "exact", head: true }).eq("account_id", ctx.acct.id).eq("status", "pending");
      if ((count ?? 0) >= MAX_PENDING_ORDERS) throw new HttpError(429, `You can have at most ${MAX_PENDING_ORDERS} pending orders.`);
      const orderId = await insertOrder(ctx, { ref, side: req.side, type: req.orderType, qty: req.qty, price: limit as number, status: "pending" });
      return { orderId, status: "pending" as const };
    }

    const orderId = await recordFill(ctx, { ref, side: req.side, qty: req.qty, price: ltp, type: req.orderType });
    if (!(await enforceRisk(ctx))) await snapshot(ctx, true);
    return { orderId, status: "filled" as const, fillPrice: ltp };
  });
}

export async function cancelOrder(userId: string, req: { accountId: string; orderId: string }) {
  return withLock(req.accountId, async () => {
    const sb = admin();
    const rows = must(await sb.from("orders").update({ status: "cancelled" })
      .eq("id", req.orderId).eq("account_id", req.accountId).eq("user_id", userId).eq("status", "pending").select("id"), "cancel order");
    if (!rows || rows.length === 0) throw new HttpError(404, "That order is no longer pending.");
    return {};
  });
}

export async function closePosition(userId: string, req: { accountId: string; instrument: string }) {
  return withLock(req.accountId, async () => {
    const ctx = await loadCtx(admin(), req.accountId, userId);
    requireActive(ctx);
    const p = ctx.positions.find((x) => x.instrument === req.instrument);
    if (!p) throw new HttpError(404, "You have no open position in that instrument.");
    const ref = parseInstrumentKey(p.instrument);
    const px = priceInstrument(ref, spotFor(ref), ctx.now);
    await recordFill(ctx, { ref, side: opposite(p.side), qty: p.qty, price: px, type: "Market" });
    if (!(await enforceRisk(ctx))) await snapshot(ctx, true);
    return { fillPrice: px };
  });
}

export async function closeAll(userId: string, req: { accountId: string }) {
  return withLock(req.accountId, async () => {
    const ctx = await loadCtx(admin(), req.accountId, userId);
    requireActive(ctx);
    let closed = 0;
    for (const p of [...ctx.positions]) {
      const ref = parseInstrumentKey(p.instrument);
      const px = priceInstrument(ref, spotFor(ref), ctx.now);
      await recordFill(ctx, { ref, side: opposite(p.side), qty: p.qty, price: px, type: "Market" });
      closed++;
    }
    must(await ctx.sb.from("orders").update({ status: "cancelled", reject_reason: "Cancelled by square off" })
      .eq("account_id", ctx.acct.id).eq("status", "pending"), "cancel pending");
    if (!(await enforceRisk(ctx))) await snapshot(ctx, true);
    return { closed };
  });
}

/* ---------- checkout (dev mode: no payment is taken) ---------- */

export async function createCheckout(userId: string, req: CheckoutRequest) {
  const devOk = process.env.PAYMENTS_MODE === "dev" || process.env.NODE_ENV !== "production";
  if (!devOk) throw new HttpError(501, "Payments are not enabled yet.");
  const sb = admin();

  const plan = must(await sb.from("plans").select("key,evaluation_phases,active").eq("key", req.planKey).maybeSingle(), "load plan");
  if (!plan || !plan.active) throw new HttpError(404, "That plan is not available.");
  const price = must(await sb.from("plan_prices").select("price_inr").eq("plan_key", req.planKey).eq("account_size", req.accountSize).maybeSingle(), "load price");
  if (!price) throw new HttpError(404, "That account size is not available for this plan.");

  const { count } = await sb.from("trading_accounts").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= MAX_ACCOUNTS_PER_USER) throw new HttpError(429, `You can hold at most ${MAX_ACCOUNTS_PER_USER} accounts.`);

  const amount = num(price.price_inr);
  const gst = round2(amount - amount / 1.18); // prices shown to buyers include 18% GST
  const purchase = must(await sb.from("purchases").insert({
    user_id: userId, plan_key: req.planKey, account_size: req.accountSize, amount_inr: amount, gst_inr: gst,
    status: "paid", gateway_ref: "dev",
  }).select("id").single(), "create purchase");

  const acct = await sb.from("trading_accounts").insert({
    user_id: userId, purchase_id: purchase.id, plan_key: req.planKey, account_size: req.accountSize,
    phase: plan.evaluation_phases === 0 ? "funded" : "phase_1", status: "active",
    balance: req.accountSize, day_start_equity: req.accountSize, day_start_date: istDate(Date.now()),
  }).select("id").single();
  if (acct.error || !acct.data) {
    await sb.from("purchases").update({ status: "failed" }).eq("id", purchase.id);
    throw new Error(`create account: ${acct.error?.message}`);
  }
  return { purchaseId: purchase.id as string, accountId: acct.data.id as string };
}

/* ---------- tick job ---------- */

async function processAccount(sb: Sb, accountId: string) {
  const ctx = await loadCtx(sb, accountId);
  if (ctx.acct.status !== "active") {
    must(await sb.from("orders").update({ status: "cancelled", reject_reason: "Account is not active" }).eq("account_id", accountId).eq("status", "pending"), "cancel pending");
    return;
  }
  await rollDay(ctx);

  const pending = must(await sb.from("orders").select("*").eq("account_id", accountId).eq("status", "pending").order("created_at"), "load pending") ?? [];
  for (const o of pending) {
    const ref: InstrumentRef = {
      underlying: o.underlying, segment: o.segment, strike: o.strike == null ? undefined : num(o.strike), expiry: o.expiry ?? undefined,
    };
    const spot = getSpot(ref.underlying);
    if (spot == null) continue;
    const ltp = priceInstrument(ref, spot, ctx.now);
    if (!isTriggered(o.order_type, o.side, num(o.price), ltp)) continue;

    const key = instrumentKey(ref);
    const ex = ctx.positions.find((p) => p.instrument === key);
    const inc = increasingQty(ex ? { side: ex.side, qty: ex.qty, avg: ex.avg_price } : null, o.side, num(o.qty));
    const need = inc > 0 ? marginRequired(ref, o.side, inc, ltp, spot) : 0;
    const b = book(ctx);
    if (!hasMargin(need, b.equity, b.used)) {
      must(await sb.from("orders").update({ status: "rejected", reject_reason: "Not enough margin when the price was reached" }).eq("id", o.id), "reject order");
      continue;
    }
    await recordFill(ctx, { ref, side: o.side, qty: num(o.qty), price: ltp, type: o.order_type, orderId: o.id });
    if (await enforceRisk(ctx)) return;
  }
  if (await enforceRisk(ctx)) return;
  if (ctx.positions.length > 0) await snapshot(ctx, false);
}

/** Fill crossed resting orders and enforce loss limits for every account with exposure. */
export async function runTick() {
  const sb = admin();
  const [o, p] = await Promise.all([
    sb.from("orders").select("account_id").eq("status", "pending").limit(2000),
    sb.from("positions").select("account_id").limit(5000),
  ]);
  const ids = new Set<string>();
  for (const r of [...(must(o, "scan orders") ?? []), ...(must(p, "scan positions") ?? [])]) ids.add(r.account_id as string);
  let done = 0;
  for (const id of ids) {
    try {
      await withLock(id, () => processAccount(sb, id));
      done++;
    } catch (e) {
      console.error("[engine] account", id, e instanceof Error ? e.message : e);
    }
  }
  return { accounts: done };
}
