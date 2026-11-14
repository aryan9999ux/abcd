import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../supabase/admin";
import { ensurePrice, getPrice, getSpot, want } from "../market/server-feed";
import { ensureInstruments, instOf, specOf } from "../market/instruments";
import { marginRequired } from "../market/pricing";
import { instrumentKey, parseInstrumentKey, type CheckoutRequest, type InstrumentRef, type OrderType, type PlaceOrderRequest, type Side } from "../types";
import { HttpError } from "./http";
import { withLock } from "./lock";
import {
  classifyOrder, daysBetween, directionOf, evaluateRisk, hasMargin, increasingQty, isTriggered, istDate, netFill, opposite,
  marketOpen, pastEntryCutoff, payoutCheck, profitableDays, riskAmount, round2, stopOnCorrectSide, strikeInRange, unrealized, validateInstrument,
  type Breach, type PositionState,
} from "./pure";
import { PLAN_RULES, type PlanRules } from "../rules";

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
  last_trading_date: string | null; breach_reason: string | null; rules: PlanRules; peak_eod_balance: number;
  cycle_no: number; cycle_start_date: string | null; payouts_count: number; purchase_id: string | null;
}
interface PosRow { id: string; instrument: string; segment: string; side: Side; qty: number; avg_price: number; stop_loss: number | null; opened_at: string }
interface Ctx { sb: Sb; acct: AccountRow; positions: PosRow[]; now: number }

const num = (v: unknown) => Number(v);
function toAccount(r: Record<string, unknown>): AccountRow {
  return {
    id: String(r.id), user_id: String(r.user_id), plan_key: String(r.plan_key), account_size: num(r.account_size),
    phase: String(r.phase), status: String(r.status), balance: num(r.balance), day_start_equity: num(r.day_start_equity),
    trading_days: num(r.trading_days), day_start_date: (r.day_start_date as string) ?? null,
    last_trading_date: (r.last_trading_date as string) ?? null, breach_reason: (r.breach_reason as string) ?? null,
    rules: (r.rules as PlanRules | null) ?? PLAN_RULES[String(r.plan_key)] ?? PLAN_RULES.one_step,
    peak_eod_balance: r.peak_eod_balance == null ? num(r.account_size) : num(r.peak_eod_balance),
    cycle_no: num(r.cycle_no ?? 0), cycle_start_date: (r.cycle_start_date as string) ?? null,
    payouts_count: num(r.payouts_count ?? 0), purchase_id: (r.purchase_id as string) ?? null,
  };
}

async function loadCtx(sb: Sb, accountId: string, userId?: string): Promise<Ctx> {
  let q = sb.from("trading_accounts").select("*").eq("id", accountId);
  if (userId) q = q.eq("user_id", userId);
  const row = must(await q.maybeSingle(), "load account");
  if (!row) throw new HttpError(404, "Account not found.");
  const acct = toAccount(row);
  const pos = must(await sb.from("positions").select("id,instrument,segment,side,qty,avg_price,stop_loss,opened_at").eq("account_id", accountId), "load positions");
  const positions = (pos ?? []).map((p: Record<string, unknown>) => ({
    ...p, qty: num(p.qty), avg_price: num(p.avg_price), stop_loss: p.stop_loss == null ? null : num(p.stop_loss),
  })) as PosRow[];
  return { sb, acct, positions, now: Date.now() };
}

/* ---------- pricing the book ---------- */

function spotFor(ref: InstrumentRef): number {
  const s = getSpot(ref.underlying);
  if (s == null) throw new HttpError(503, `No price for ${ref.underlying} right now. Try again in a moment.`);
  return s;
}

/** Real live price of a contract; refuses to continue (never guesses) when the feed has none. */
function markFor(ref: InstrumentRef): number {
  const p = getPrice(ref);
  if (p == null) throw new HttpError(503, `No live price for ${ref.underlying}${ref.segment === "EQ" ? "" : " " + ref.segment} right now. Try again in a moment.`);
  return p;
}

const MARKET_HOURS_ON = process.env.MARKET_HOURS_OFF !== "1";
function requireMarketOpen(now: number) {
  if (MARKET_HOURS_ON && !marketOpen(now)) throw new HttpError(422, "The market is closed. Orders are accepted Monday to Friday, 9:15 AM to 3:30 PM IST.");
}

function book(ctx: Ctx) {
  let upl = 0, used = 0;
  for (const p of ctx.positions) {
    const ref = parseInstrumentKey(p.instrument);
    const spot = spotFor(ref);
    const mark = markFor(ref);
    upl += unrealized({ side: p.side, qty: p.qty, avg: p.avg_price }, mark);
    used += marginRequired(ref, p.side, p.qty, p.avg_price, spot);
  }
  return { equity: round2(ctx.acct.balance + upl), used: round2(used) };
}

/* ---------- writes ---------- */

async function insertOrder(ctx: Ctx, o: {
  ref: InstrumentRef; side: Side; type: OrderType; qty: number; price: number | null;
  status: "pending" | "filled" | "rejected"; reason?: string; stopLoss?: number | null; risk?: number | null;
}): Promise<string> {
  const row = must(await ctx.sb.from("orders").insert({
    user_id: ctx.acct.user_id, account_id: ctx.acct.id, instrument: instrumentKey(o.ref), segment: o.ref.segment,
    underlying: o.ref.underlying, strike: o.ref.strike ?? null, expiry: o.ref.expiry ?? null, side: o.side,
    order_type: o.type, qty: o.qty, price: o.price, status: o.status, reject_reason: o.reason ?? null,
    filled_at: o.status === "filled" ? new Date(ctx.now).toISOString() : null,
    stop_loss: o.stopLoss ?? null, risk_inr: o.risk ?? null,
  }).select("id").single(), "insert order");
  return row.id as string;
}

/** Apply one fill: order row, trade, position (net/average/flip) and account balance. */
async function recordFill(ctx: Ctx, f: {
  ref: InstrumentRef; side: Side; qty: number; price: number; type: OrderType; orderId?: string; stopLoss?: number | null; risk?: number | null;
}): Promise<string> {
  const key = instrumentKey(f.ref);
  const existing = ctx.positions.find((p) => p.instrument === key);
  const state: PositionState | null = existing ? { side: existing.side, qty: existing.qty, avg: existing.avg_price } : null;
  const { next, realized } = netFill(state, f.side, f.qty, f.price);

  let orderId = f.orderId;
  if (orderId) {
    must(await ctx.sb.from("orders").update({ status: "filled", filled_at: new Date(ctx.now).toISOString() }).eq("id", orderId), "fill order");
  } else {
    orderId = await insertOrder(ctx, { ref: f.ref, side: f.side, type: f.type, qty: f.qty, price: f.price, status: "filled", stopLoss: f.stopLoss, risk: f.risk });
  }
  must(await ctx.sb.from("trades").insert({
    user_id: ctx.acct.user_id, account_id: ctx.acct.id, order_id: orderId, instrument: key, side: f.side,
    qty: f.qty, price: f.price, realized_pnl: realized,
  }), "insert trade");

  if (existing && next) {
    const stop = f.stopLoss != null && next.side === f.side ? f.stopLoss : existing.stop_loss;
    must(await ctx.sb.from("positions").update({ side: next.side, qty: next.qty, avg_price: next.avg, stop_loss: stop }).eq("id", existing.id), "update position");
    Object.assign(existing, { side: next.side, qty: next.qty, avg_price: next.avg, stop_loss: stop });
  } else if (existing) {
    must(await ctx.sb.from("positions").delete().eq("id", existing.id), "delete position");
    ctx.positions = ctx.positions.filter((p) => p !== existing);
  } else if (next) {
    const row = must(await ctx.sb.from("positions").insert({
      user_id: ctx.acct.user_id, account_id: ctx.acct.id, instrument: key, segment: f.ref.segment,
      side: next.side, qty: next.qty, avg_price: next.avg, stop_loss: f.stopLoss ?? null,
    }).select("id").single(), "insert position");
    ctx.positions.push({ id: row.id as string, instrument: key, segment: f.ref.segment, side: next.side, qty: next.qty, avg_price: next.avg, stop_loss: f.stopLoss ?? null, opened_at: new Date(ctx.now).toISOString() });
  }

  const today = istDate(ctx.now);
  const newDay = ctx.acct.last_trading_date !== today;
  const patch = {
    balance: round2(ctx.acct.balance + realized),
    trading_days: ctx.acct.trading_days + (newDay ? 1 : 0),
    last_trading_date: today,
    cycle_start_date: ctx.acct.cycle_start_date ?? today,
  };
  must(await ctx.sb.from("trading_accounts").update(patch).eq("id", ctx.acct.id), "update account");
  Object.assign(ctx.acct, patch);
  if (realized !== 0) await addDayResult(ctx, today, realized);
  return orderId;
}

const snapAt = ((globalThis as unknown as { __propSnap?: Map<string, number> }).__propSnap ??= new Map());
async function snapshot(ctx: Ctx, force: boolean) {
  if (!force && ctx.now - (snapAt.get(ctx.acct.id) ?? 0) < SNAPSHOT_EVERY_MS) return;
  snapAt.set(ctx.acct.id, ctx.now);
  const { equity } = book(ctx);
  must(await ctx.sb.from("equity_snapshots").insert({ user_id: ctx.acct.user_id, account_id: ctx.acct.id, equity }), "equity snapshot");
}

async function addDayResult(ctx: Ctx, day: string, pnl: number) {
  const where = { account_id: ctx.acct.id, cycle_no: ctx.acct.cycle_no, day };
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = must(await ctx.sb.from("day_results").select("pnl").match(where).maybeSingle(), "load day result");
    if (cur) {
      must(await ctx.sb.from("day_results").update({ pnl: round2(num(cur.pnl) + pnl) }).match(where), "update day result");
      return;
    }
    const { error } = await ctx.sb.from("day_results").insert({ ...where, pnl: round2(pnl) });
    if (!error) return;
    // Another worker created the row first: loop and add to it instead.
    if (error.code !== "23505") throw new Error(`insert day result: ${error.message}`);
  }
  throw new Error("insert day result: too many conflicts");
}

async function dayPnls(ctx: Ctx): Promise<number[]> {
  const rows = must(await ctx.sb.from("day_results").select("pnl").eq("account_id", ctx.acct.id).eq("cycle_no", ctx.acct.cycle_no), "load day results") ?? [];
  return rows.map((r: { pnl: unknown }) => num(r.pnl));
}

async function rollDay(ctx: Ctx) {
  const today = istDate(ctx.now);
  if (ctx.acct.day_start_date === today) return;
  const { equity } = book(ctx);
  // The trailing floor follows the highest closed balance at the end of a day.
  const patch = { day_start_equity: equity, day_start_date: today, peak_eod_balance: Math.max(ctx.acct.peak_eod_balance, ctx.acct.balance) };
  must(await ctx.sb.from("trading_accounts").update(patch).eq("id", ctx.acct.id), "roll day");
  Object.assign(ctx.acct, patch);
}

const breachText = (b: Breach, ctx: Ctx): string =>
  b === "overall_loss_limit" ? "Maximum drawdown reached"
    : b === "daily_loss_limit" ? "Daily loss limit reached"
    : `More than ${ctx.acct.rules.maxOpenPositions} open positions`;

async function squareOff(ctx: Ctx, breach: Breach) {
  must(await ctx.sb.from("orders").update({ status: "cancelled", reject_reason: breachText(breach, ctx) })
    .eq("account_id", ctx.acct.id).eq("status", "pending"), "cancel pending");
  for (const p of [...ctx.positions]) {
    const ref = parseInstrumentKey(p.instrument);
    const px = markFor(ref);
    await recordFill(ctx, { ref, side: opposite(p.side), qty: p.qty, price: px, type: "Market" });
  }
  const patch = { status: "breached", breach_reason: breachText(breach, ctx) };
  must(await ctx.sb.from("trading_accounts").update(patch).eq("id", ctx.acct.id), "breach account");
  // A breach cancels any payout that was not paid yet.
  must(await ctx.sb.from("rewards").update({ status: "rejected" }).eq("account_id", ctx.acct.id).eq("status", "requested"), "cancel payout request");
  Object.assign(ctx.acct, patch);
  await snapshot(ctx, true);
}

/** Check loss limits against the live book; square off and close the account on a breach. */
async function enforceRisk(ctx: Ctx): Promise<boolean> {
  const { equity } = book(ctx);
  const rl = ctx.acct.rules;
  const r = evaluateRisk({
    accountSize: ctx.acct.account_size, dayStartEquity: ctx.acct.day_start_equity, equity,
    dailyLossPct: rl.dailyLossPct, drawdownPct: rl.drawdownPct, drawdownType: rl.drawdownType, peakEod: ctx.acct.peak_eod_balance,
  });
  if (!r.breach) return false;
  await squareOff(ctx, r.breach);
  return true;
}

/** Move to the next phase when the closed-profit target and the profitable-day count are both met while flat. */
async function maybePromote(ctx: Ctx): Promise<void> {
  const a = ctx.acct;
  if (a.status !== "active" || a.phase === "funded" || ctx.positions.length > 0) return;
  const idx = a.phase === "phase_1" ? 0 : 1;
  const target = a.rules.targetsPct[idx];
  if (target == null) return;
  if (a.balance - a.account_size < (a.account_size * target) / 100 - 1e-6) return;
  const days = profitableDays(await dayPnls(ctx), a.account_size, a.rules.evalProfitableDay.pct);
  if (days < a.rules.evalProfitableDay.days) return;
  const next = a.phase === "phase_1" && a.rules.targetsPct.length > 1 ? "phase_2" : "funded";
  const today = istDate(ctx.now);
  const patch = {
    phase: next, balance: a.account_size, day_start_equity: a.account_size, day_start_date: today,
    peak_eod_balance: a.account_size, cycle_no: a.cycle_no + 1, cycle_start_date: today,
  };
  must(await ctx.sb.from("trading_accounts").update(patch).eq("id", a.id), "promote account");
  Object.assign(a, patch);
}

/** After any change to the book: enforce limits, otherwise check for promotion and record equity. Returns true if breached. */
async function afterChange(ctx: Ctx): Promise<boolean> {
  if (await enforceRisk(ctx)) return true;
  await maybePromote(ctx);
  await snapshot(ctx, true);
  return false;
}

/* ---------- public operations ---------- */

function refOf(req: { underlying: string; segment: InstrumentRef["segment"]; strike?: number | null; expiry?: string | null }): InstrumentRef {
  return { underlying: req.underlying, segment: req.segment, strike: req.strike ?? undefined, expiry: req.expiry ?? undefined };
}

function requireActive(ctx: Ctx) {
  if (ctx.acct.status !== "active") throw new HttpError(403, ctx.acct.breach_reason ? `This account is closed: ${ctx.acct.breach_reason}.` : `This account is ${ctx.acct.status}.`);
}

async function underReview(ctx: Ctx): Promise<boolean> {
  const { count } = await ctx.sb.from("rewards").select("id", { count: "exact", head: true }).eq("account_id", ctx.acct.id).eq("status", "requested");
  return (count ?? 0) > 0;
}

/** Rules that apply when an order adds exposure. Returns the order's risk in rupees; throws a plain message when blocked. */
async function checkOpeningRules(ctx: Ctx, o: {
  ref: InstrumentRef; side: Side; qty: number; entry: number; stop: number | null | undefined; existing: PosRow | undefined;
}): Promise<number> {
  const r = ctx.acct.rules;
  if (pastEntryCutoff(ctx.now, r.entryCutoffIST)) throw new HttpError(422, `No new positions after ${r.entryCutoffIST.replace(/^(\d+):(\d+)$/, (_m, h, m) => `${Number(h) % 12 || 12}:${m} ${Number(h) >= 12 ? "PM" : "AM"}`)}. You can still close positions.`);
  if (o.stop == null) throw new HttpError(422, "Add a stop loss. Every trade needs one.");
  if (!stopOnCorrectSide(o.side, o.stop, o.entry)) {
    throw new HttpError(422, o.side === "Buy" ? "The stop loss must be below your buy price." : "The stop loss must be above your sell price.");
  }
  const ex = o.existing;
  const qtyAfter = (ex ? ex.qty : 0) + o.qty;
  const avgAfter = ex ? (ex.avg_price * ex.qty + o.entry * o.qty) / qtyAfter : o.entry;
  const risk = riskAmount(avgAfter, o.stop, qtyAfter);
  const maxRisk = round2((ctx.acct.balance * r.riskPerTradePct) / 100);
  if (risk > maxRisk) {
    throw new HttpError(422, `Risk is too high: ₹${Math.ceil(risk).toLocaleString("en-IN")} at your stop, the limit is ₹${Math.floor(maxRisk).toLocaleString("en-IN")} (${r.riskPerTradePct}% of balance). Reduce the quantity or move the stop closer.`);
  }
  const newRisk = round2(riskAmount(o.entry, o.stop, o.qty));

  // one idea (same underlying and direction, same day) cannot carry more than a share of the daily limit
  const dayStart = new Date(Date.parse(istDate(ctx.now) + "T00:00:00+05:30")).toISOString();
  const today = must(await ctx.sb.from("orders").select("underlying,segment,side,risk_inr").eq("account_id", ctx.acct.id)
    .eq("status", "filled").not("risk_inr", "is", null).gte("filled_at", dayStart), "load today's orders") ?? [];
  const dirNow = directionOf(o.ref.segment, o.side);
  const used = today
    .filter((t: Record<string, unknown>) => t.underlying === o.ref.underlying && directionOf(String(t.segment), t.side as Side) === dirNow)
    .reduce((sum: number, t: Record<string, unknown>) => sum + num(t.risk_inr), 0);
  const cap = round2(((ctx.acct.account_size * r.dailyLossPct) / 100) * (r.ideaCapPctOfDaily / 100));
  if (used + newRisk > cap) {
    throw new HttpError(422, `Too much risk on one idea today: ₹${Math.ceil(used + newRisk).toLocaleString("en-IN")} on ${o.ref.underlying} ${dirNow}, the limit is ₹${Math.floor(cap).toLocaleString("en-IN")}.`);
  }

  if (r.largestTradeMultiple != null) {
    const since = ctx.acct.cycle_start_date ? new Date(Date.parse(ctx.acct.cycle_start_date + "T00:00:00+05:30")).toISOString() : "1970-01-01";
    const past = must(await ctx.sb.from("orders").select("risk_inr").eq("account_id", ctx.acct.id).eq("status", "filled")
      .not("risk_inr", "is", null).gte("filled_at", since).limit(300), "load past risk") ?? [];
    if (past.length >= 5) {
      const avg = past.reduce((a: number, t: { risk_inr: unknown }) => a + num(t.risk_inr), 0) / past.length;
      if (newRisk > avg * r.largestTradeMultiple) {
        throw new HttpError(422, `This trade risks ₹${Math.ceil(newRisk).toLocaleString("en-IN")}, more than ${r.largestTradeMultiple}× your average trade (₹${Math.ceil(avg).toLocaleString("en-IN")}).`);
      }
    }
  }
  return newRisk;
}

/** Opening one position too many ends the account. */
async function breachIfTooManyPositions(ctx: Ctx, existing: PosRow | undefined) {
  if (existing || ctx.positions.length < ctx.acct.rules.maxOpenPositions) return;
  await squareOff(ctx, "max_positions");
  throw new HttpError(403, `Account closed: ${breachText("max_positions", ctx)}. All positions were closed.`);
}

export async function placeOrder(userId: string, req: PlaceOrderRequest) {
  return withLock(req.accountId, async () => {
    const ctx = await loadCtx(admin(), req.accountId, userId);
    requireActive(ctx);
    const ref = refOf(req);
    await ensureInstruments();
    const bad = validateInstrument(ref, req.qty, specOf(ref.underlying));
    if (bad) throw new HttpError(400, bad);
    if (ref.segment !== "EQ" && !instOf(ref)) throw new HttpError(400, "That contract is not listed on the exchange.");
    requireMarketOpen(ctx.now);
    await ensurePrice(ref);
    const spot = spotFor(ref);
    if (ref.strike != null && !strikeInRange(ref.strike, spot)) throw new HttpError(400, "That strike is too far from the current price.");
    await rollDay(ctx);

    const ltp = markFor(ref);
    const limit = req.orderType === "Market" ? undefined : (req.price ?? undefined);
    const action = classifyOrder(req.orderType, req.side, limit, ltp);
    if (action === "invalid") {
      throw new HttpError(400, limit == null ? "Enter a price for this order." : "A stop order must be placed beyond the current price.");
    }

    const key = instrumentKey(ref);
    const ex = ctx.positions.find((p) => p.instrument === key);
    if (await underReview(ctx)) throw new HttpError(403, "Your payout request is under review. Trading is paused until it is decided.");
    const inc = increasingQty(ex ? { side: ex.side, qty: ex.qty, avg: ex.avg_price } : null, req.side, req.qty);
    const estPx = action === "fill" ? ltp : (limit as number);
    let risk: number | null = null;
    let stop: number | null = null;
    if (ex && ex.side !== req.side) {
      if (req.qty > ex.qty) throw new HttpError(422, "Close the position first, then open the opposite one.");
      const heldFor = ctx.now - Date.parse(ex.opened_at);
      if (heldFor < ctx.acct.rules.minHoldSeconds * 1000) {
        throw new HttpError(422, `A position must stay open for ${ctx.acct.rules.minHoldSeconds} seconds. Try again in ${Math.ceil((ctx.acct.rules.minHoldSeconds * 1000 - heldFor) / 1000)}s.`);
      }
    } else {
      await breachIfTooManyPositions(ctx, ex);
      stop = req.stopLoss ?? null;
      risk = await checkOpeningRules(ctx, { ref, side: req.side, qty: req.qty, entry: estPx, stop, existing: ex });
    }
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
      const orderId = await insertOrder(ctx, { ref, side: req.side, type: req.orderType, qty: req.qty, price: limit as number, status: "pending", stopLoss: stop, risk });
      return { orderId, status: "pending" as const };
    }

    const orderId = await recordFill(ctx, { ref, side: req.side, qty: req.qty, price: ltp, type: req.orderType, stopLoss: stop, risk });
    await afterChange(ctx);
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
    requireMarketOpen(ctx.now);
    const held = ctx.now - Date.parse(p.opened_at);
    if (held < ctx.acct.rules.minHoldSeconds * 1000) {
      throw new HttpError(422, `A position must stay open for ${ctx.acct.rules.minHoldSeconds} seconds. Try again in ${Math.ceil((ctx.acct.rules.minHoldSeconds * 1000 - held) / 1000)}s. Your stop loss still works.`);
    }
    const ref = parseInstrumentKey(p.instrument);
    const px = markFor(ref);
    await recordFill(ctx, { ref, side: opposite(p.side), qty: p.qty, price: px, type: "Market" });
    await afterChange(ctx);
    return { fillPrice: px };
  });
}

export async function closeAll(userId: string, req: { accountId: string }) {
  return withLock(req.accountId, async () => {
    const ctx = await loadCtx(admin(), req.accountId, userId);
    requireActive(ctx);
    requireMarketOpen(ctx.now);
    const young = ctx.positions.find((p) => ctx.now - Date.parse(p.opened_at) < ctx.acct.rules.minHoldSeconds * 1000);
    if (young) throw new HttpError(422, `Positions must stay open for ${ctx.acct.rules.minHoldSeconds} seconds before they can be closed. Your stop losses still work.`);
    let closed = 0;
    for (const p of [...ctx.positions]) {
      const ref = parseInstrumentKey(p.instrument);
      const px = markFor(ref);
      await recordFill(ctx, { ref, side: opposite(p.side), qty: p.qty, price: px, type: "Market" });
      closed++;
    }
    must(await ctx.sb.from("orders").update({ status: "cancelled", reject_reason: "Cancelled by square off" })
      .eq("account_id", ctx.acct.id).eq("status", "pending"), "cancel pending");
    await afterChange(ctx);
    return { closed };
  });
}

/* ---------- checkout (dev mode: no payment is taken) ---------- */

export async function createCheckout(userId: string, req: CheckoutRequest) {
  const devOk = process.env.PAYMENTS_MODE === "dev" || process.env.NODE_ENV !== "production";
  if (!devOk) throw new HttpError(501, "Payments are not enabled yet.");
  const sb = admin();

  const plan = must(await sb.from("plans").select("key,evaluation_phases,active,rules").eq("key", req.planKey).maybeSingle(), "load plan");
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
    rules: plan.rules ?? PLAN_RULES[req.planKey] ?? null, peak_eod_balance: req.accountSize,
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

  // Stop losses close the position on the live price, with no waiting period.
  for (const p of [...ctx.positions]) {
    if (p.stop_loss == null) continue;
    const ref = parseInstrumentKey(p.instrument);
    const ltp = getPrice(ref);
    if (ltp == null) continue;
    const hit = p.side === "Buy" ? ltp <= p.stop_loss : ltp >= p.stop_loss;
    if (!hit) continue;
    await recordFill(ctx, { ref, side: opposite(p.side), qty: p.qty, price: ltp, type: "Stop" });
    if (await enforceRisk(ctx)) return;
  }

  const pending = must(await sb.from("orders").select("*").eq("account_id", accountId).eq("status", "pending").order("created_at"), "load pending") ?? [];
  for (const o of pending) {
    const ref: InstrumentRef = {
      underlying: o.underlying, segment: o.segment, strike: o.strike == null ? undefined : num(o.strike), expiry: o.expiry ?? undefined,
    };
    const ltp = getPrice(ref);
    if (ltp == null) continue;
    if (!isTriggered(o.order_type, o.side, num(o.price), ltp)) continue;

    const key = instrumentKey(ref);
    const ex = ctx.positions.find((p) => p.instrument === key);
    const inc = increasingQty(ex ? { side: ex.side, qty: ex.qty, avg: ex.avg_price } : null, o.side, num(o.qty));
    const opening = !ex || ex.side === o.side;
    if (opening) {
      if (pastEntryCutoff(ctx.now, ctx.acct.rules.entryCutoffIST)) {
        must(await sb.from("orders").update({ status: "rejected", reject_reason: "Past the entry cutoff time" }).eq("id", o.id), "reject order");
        continue;
      }
      try {
        await breachIfTooManyPositions(ctx, ex);
      } catch {
        return; // account was closed by the position limit
      }
    } else if (num(o.qty) > ex.qty) {
      must(await sb.from("orders").update({ status: "rejected", reject_reason: "Quantity is more than the open position" }).eq("id", o.id), "reject order");
      continue;
    }
    const spot = getSpot(ref.underlying);
    if (spot == null) continue;
    const need = inc > 0 ? marginRequired(ref, o.side, inc, ltp, spot) : 0;
    const b = book(ctx);
    if (!hasMargin(need, b.equity, b.used)) {
      must(await sb.from("orders").update({ status: "rejected", reject_reason: "Not enough margin when the price was reached" }).eq("id", o.id), "reject order");
      continue;
    }
    await recordFill(ctx, {
      ref, side: o.side, qty: num(o.qty), price: ltp, type: o.order_type, orderId: o.id,
      stopLoss: o.stop_loss == null ? null : num(o.stop_loss), risk: o.risk_inr == null ? null : num(o.risk_inr),
    });
    if (await enforceRisk(ctx)) return;
  }
  if (await enforceRisk(ctx)) return;
  await maybePromote(ctx);
  if (ctx.positions.length > 0) await snapshot(ctx, false);
}

/** Fill crossed resting orders and enforce loss limits for every account with exposure. */
export async function runTick() {
  const sb = admin();
  const [o, p] = await Promise.all([
    sb.from("orders").select("account_id,instrument").eq("status", "pending").limit(2000),
    sb.from("positions").select("account_id,instrument").limit(5000),
  ]);
  const ids = new Set<string>();
  const rows = [...(must(o, "scan orders") ?? []), ...(must(p, "scan positions") ?? [])];
  for (const r of rows) ids.add(r.account_id as string);
  // Keep every contract that someone holds or waits on priced by the live feed.
  want([...new Set(rows.map((r: { instrument: string }) => r.instrument).filter((k: string) => k.includes("|") && !k.includes("|EQ|")))], 60_000);
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


/* ---------- rewards (payouts) ---------- */

export async function requestPayout(userId: string, accountId: string) {
  return withLock(accountId, async () => {
    const ctx = await loadCtx(admin(), accountId, userId);
    const a = ctx.acct;
    if (a.status !== "active") throw new HttpError(403, "This account is not active.");
    if (a.phase !== "funded") throw new HttpError(422, "Rewards open once the account is funded.");
    const kyc = must(await ctx.sb.from("kyc_status").select("verified").eq("user_id", userId).maybeSingle(), "load kyc");
    const need = a.rules.fundedProfitableDay;
    const days = profitableDays(await dayPnls(ctx), a.account_size, need.pct);
    const check = payoutCheck({
      accountSize: a.account_size, balance: a.balance, flat: ctx.positions.length === 0, kycVerified: !!kyc?.verified,
      daysSinceCycleStart: a.cycle_start_date ? daysBetween(a.cycle_start_date, istDate(ctx.now)) : null,
      profitableDays: days, needDays: need.days, cycleDays: a.rules.payout.cycleDays, minProfitPct: a.rules.payout.minProfitPct,
      minPayoutInr: a.rules.payout.minPayoutInr, splitPct: a.rules.payout.splitPct, underReview: await underReview(ctx),
    });
    if (!check.ok) throw new HttpError(422, check.reasons.join(" "));
    let refund = 0;
    if (a.rules.payout.feeRefundAtPayout === a.payouts_count + 1 && a.purchase_id) {
      const pu = must(await ctx.sb.from("purchases").select("amount_inr").eq("id", a.purchase_id).maybeSingle(), "load purchase");
      refund = pu ? num(pu.amount_inr) : 0;
    }
    const row = must(await ctx.sb.from("rewards").insert({
      user_id: userId, account_id: accountId, amount_inr: round2(check.payable + refund), split_pct: a.rules.payout.splitPct,
      fee_refund_inr: refund, cycle_no: a.cycle_no, gross_profit_inr: check.profit,
    }).select("id").single(), "create reward request");
    return { rewardId: row.id as string, payable: check.payable, feeRefund: refund };
  });
}

/** Admin decision on a payout request. Approval starts the next cycle: balance back to the start, drawdown room restored. */
export async function decideReward(rewardId: string, action: "approve" | "reject" | "paid", payoutRef?: string) {
  const sb = admin();
  const rw = must(await sb.from("rewards").select("*").eq("id", rewardId).maybeSingle(), "load reward");
  if (!rw) throw new HttpError(404, "Reward not found.");
  return withLock(String(rw.account_id), async () => {
    if (action === "reject") {
      if (rw.status !== "requested") throw new HttpError(409, "Only requested payouts can be rejected.");
      must(await sb.from("rewards").update({ status: "rejected" }).eq("id", rewardId), "reject reward");
      return {};
    }
    if (action === "paid") {
      if (rw.status !== "approved") throw new HttpError(409, "Approve the payout first.");
      must(await sb.from("rewards").update({ status: "paid", paid_at: new Date().toISOString(), payout_ref: payoutRef ?? null }).eq("id", rewardId), "mark paid");
      return {};
    }
    if (rw.status !== "requested") throw new HttpError(409, "Only requested payouts can be approved.");
    const ctx = await loadCtx(sb, String(rw.account_id));
    if (ctx.acct.status !== "active") throw new HttpError(409, "The account is no longer active.");
    if (ctx.positions.length > 0) throw new HttpError(409, "The account has open positions.");
    const today = istDate(Date.now());
    const patch = {
      balance: ctx.acct.account_size, day_start_equity: ctx.acct.account_size, day_start_date: today,
      peak_eod_balance: ctx.acct.account_size, cycle_no: ctx.acct.cycle_no + 1, cycle_start_date: today,
      payouts_count: ctx.acct.payouts_count + 1,
    };
    must(await sb.from("trading_accounts").update(patch).eq("id", ctx.acct.id), "reset account");
    must(await sb.from("rewards").update({ status: "approved" }).eq("id", rewardId), "approve reward");
    return {};
  });
}
