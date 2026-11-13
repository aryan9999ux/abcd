/**
 * Pure trading rules: no I/O, no clock, no framework. Everything the engine decides
 * (netting, order triggers, margin headroom, loss limits, instrument validity) lives here so it can be tested alone.
 */
import type { InstrumentRef, OrderType, Side } from "../types";
import { expiriesFor, isIndex, isStock, lotSize, strikeStep } from "../market/pricing";

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const dir = (s: Side) => (s === "Buy" ? 1 : -1);
export const opposite = (s: Side): Side => (s === "Buy" ? "Sell" : "Buy");

export interface PositionState { side: Side; qty: number; avg: number }

/** Apply a fill to the existing position (one row per instrument). Returns the new state and realized P&L. */
export function netFill(existing: PositionState | null, side: Side, qty: number, price: number) {
  if (!existing) return { next: { side, qty, avg: round2(price) } as PositionState | null, realized: 0 };
  if (existing.side === side) {
    const total = existing.qty + qty;
    return { next: { side, qty: total, avg: round2((existing.avg * existing.qty + price * qty) / total) } as PositionState | null, realized: 0 };
  }
  const closed = Math.min(existing.qty, qty);
  const realized = round2((price - existing.avg) * closed * dir(existing.side));
  const remaining = existing.qty - closed;
  if (remaining > 0) return { next: { side: existing.side, qty: remaining, avg: existing.avg } as PositionState | null, realized };
  const flipped = qty - closed;
  return { next: (flipped > 0 ? { side, qty: flipped, avg: round2(price) } : null) as PositionState | null, realized };
}

export const unrealized = (p: PositionState, mark: number) => round2((mark - p.avg) * p.qty * dir(p.side));

/** Units of an order that add exposure (reducing orders need no new margin). */
export function increasingQty(existing: PositionState | null, side: Side, qty: number): number {
  if (!existing || existing.side === side) return qty;
  return Math.max(0, qty - existing.qty);
}

export type Trigger = "fill" | "pending" | "invalid";

/** What to do with an order at placement time, given the current instrument price. */
export function classifyOrder(type: OrderType, side: Side, price: number | undefined, ltp: number): Trigger {
  if (type === "Market") return "fill";
  if (price == null || !(price > 0)) return "invalid";
  if (type === "Limit") return side === "Buy" ? (price >= ltp ? "fill" : "pending") : price <= ltp ? "fill" : "pending";
  return side === "Buy" ? (price > ltp ? "pending" : "invalid") : price < ltp ? "pending" : "invalid";
}

/** Has a resting order's price been crossed? */
export function isTriggered(type: OrderType, side: Side, price: number, ltp: number): boolean {
  if (type === "Limit") return side === "Buy" ? ltp <= price : ltp >= price;
  if (type === "Stop") return side === "Buy" ? ltp >= price : ltp <= price;
  return true;
}

export type Breach = "overall_loss_limit" | "daily_loss_limit" | "max_positions";

export interface RiskInput {
  accountSize: number;
  dayStartEquity: number;
  equity: number;
  dailyLossPct: number;
  drawdownPct: number;
  drawdownType: "static" | "trailing";
  /** Highest end-of-day closed balance so far (trailing only). */
  peakEod: number;
}

/** Lowest equity allowed. Static: fixed. Trailing: peak minus the drawdown, never above the starting balance (it locks there). */
export function drawdownFloor(r: Pick<RiskInput, "accountSize" | "drawdownPct" | "drawdownType" | "peakEod">): number {
  const room = (r.accountSize * r.drawdownPct) / 100;
  if (r.drawdownType === "static") return round2(r.accountSize - room);
  return round2(Math.min(r.accountSize, Math.max(r.peakEod, r.accountSize) - room));
}

/** Loss limits are measured against the starting account size. Returns the breach, if any, and how much of each limit is used. */
export function evaluateRisk(r: RiskInput) {
  const overallFloor = drawdownFloor(r);
  const dailyRoom = (r.accountSize * r.dailyLossPct) / 100;
  const dailyFloor = r.dayStartEquity - dailyRoom;
  const overallRoom = Math.max(1, Math.max(r.peakEod, r.accountSize) - overallFloor);
  const breach: Breach | null = r.equity <= overallFloor ? "overall_loss_limit" : r.equity <= dailyFloor ? "daily_loss_limit" : null;
  return {
    breach,
    overallFloor,
    dailyFloor: round2(dailyFloor),
    overallUsedPct: Math.max(0, ((Math.max(r.peakEod, r.accountSize) - r.equity) / overallRoom) * 100),
    dailyUsedPct: Math.max(0, ((r.dayStartEquity - r.equity) / dailyRoom) * 100),
  };
}

/** Minutes after midnight, India time. */
export const istMinutes = (now: number) => {
  const d = new Date(now + 330 * 60 * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
/** True from the cutoff time ("15:15") to midnight: no new positions. */
export function pastEntryCutoff(now: number, cutoff: string): boolean {
  const [h, m] = cutoff.split(":").map(Number);
  return istMinutes(now) >= h * 60 + m;
}

/** Market direction of a position: long calls, short puts, long futures and stocks are "long". */
export function directionOf(segment: string, side: Side): "long" | "short" {
  const bullish = segment === "PE" ? side === "Sell" : side === "Buy";
  return bullish ? "long" : "short";
}

/** A stop must sit on the losing side of the entry price. */
export const stopOnCorrectSide = (side: Side, stop: number, entry: number) => (side === "Buy" ? stop < entry : stop > entry);
export const riskAmount = (entry: number, stop: number, qty: number) => round2(Math.abs(entry - stop) * qty);

/** Number of days in the list whose closed profit is at least pct% of the starting balance. */
export function profitableDays(pnls: number[], accountSize: number, pct: number): number {
  const need = (accountSize * pct) / 100;
  return pnls.filter((p) => p >= need - 1e-9).length;
}

export interface PayoutCheck { ok: boolean; reasons: string[]; profit: number; payable: number }
export function payoutCheck(i: {
  accountSize: number; balance: number; flat: boolean; kycVerified: boolean; daysSinceCycleStart: number | null;
  profitableDays: number; needDays: number; cycleDays: number; minProfitPct: number; minPayoutInr: number; splitPct: number; underReview: boolean;
}): PayoutCheck {
  const profit = round2(i.balance - i.accountSize);
  const payable = round2(Math.max(0, profit) * (i.splitPct / 100));
  const reasons: string[] = [];
  if (i.underReview) reasons.push("A payout request is already under review.");
  if (!i.flat) reasons.push("Close all open positions first.");
  if (!i.kycVerified) reasons.push("KYC is not verified yet.");
  if (i.daysSinceCycleStart == null || i.daysSinceCycleStart < i.cycleDays) {
    reasons.push(`Payouts open ${i.cycleDays} days after the cycle starts.`);
  }
  if (i.profitableDays < i.needDays) reasons.push(`You need ${i.needDays} profitable days in this cycle (you have ${i.profitableDays}).`);
  if (profit < (i.accountSize * i.minProfitPct) / 100) reasons.push(`Closed profit must be at least ${i.minProfitPct}% of the starting balance.`);
  if (payable < i.minPayoutInr) reasons.push(`The minimum payout is ₹${i.minPayoutInr.toLocaleString("en-IN")}.`);
  return { ok: reasons.length === 0, reasons, profit, payable };
}

/** Whole IST days between two YYYY-MM-DD dates. */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

export const hasMargin = (need: number, equity: number, used: number) => need <= equity - used + 1e-9;

/** Shape checks that do not need prices. Returns an error message or null. */
export function validateInstrument(ref: InstrumentRef, qty: number, now = Date.now()): string | null {
  const { underlying, segment, strike, expiry } = ref;
  if (!Number.isInteger(qty) || qty <= 0) return "Quantity must be a whole number above zero.";
  if (segment === "EQ") {
    if (!isStock(underlying)) return `${underlying} is not available in the cash segment.`;
    if (strike != null || expiry) return "Cash stocks have no strike or expiry.";
    return null;
  }
  if (!isIndex(underlying)) return `${underlying} has no futures or options here.`;
  if (!expiry || !expiriesFor(underlying, now).includes(expiry)) return "That expiry is not available.";
  const lot = lotSize(underlying);
  if (qty % lot !== 0) return `Quantity must be a multiple of the lot size (${lot}).`;
  if (segment === "FUT") return strike != null ? "Futures have no strike." : null;
  if (strike == null || !(strike > 0)) return "Options need a strike.";
  if (strike % strikeStep(underlying) !== 0) return `Strike must be a multiple of ${strikeStep(underlying)}.`;
  return null;
}

/** Strikes far from spot are not offered; the engine refuses them too. */
export function strikeInRange(strike: number, spot: number): boolean {
  return Math.abs(strike / spot - 1) <= 0.2;
}

/** India Standard Time calendar date (YYYY-MM-DD). */
export function istDate(now: number): string {
  return new Date(now + 330 * 60 * 1000).toISOString().slice(0, 10);
}
