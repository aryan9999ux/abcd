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

export type Breach = "overall_loss_limit" | "daily_loss_limit";

export interface RiskInput {
  accountSize: number;
  dayStartEquity: number;
  equity: number;
  maxDailyPct: number;
  maxOverallPct: number;
}

/** Loss limits are measured against the starting account size. Returns the breach, if any, and how much of each limit is used. */
export function evaluateRisk(r: RiskInput) {
  const overallFloor = r.accountSize * (1 - r.maxOverallPct / 100);
  const dailyFloor = r.dayStartEquity - (r.accountSize * r.maxDailyPct) / 100;
  const overallAllowed = r.accountSize - overallFloor;
  const dailyAllowed = r.dayStartEquity - dailyFloor;
  const breach: Breach | null = r.equity <= overallFloor ? "overall_loss_limit" : r.equity <= dailyFloor ? "daily_loss_limit" : null;
  return {
    breach,
    overallUsedPct: Math.max(0, ((r.accountSize - r.equity) / overallAllowed) * 100),
    dailyUsedPct: Math.max(0, ((r.dayStartEquity - r.equity) / dailyAllowed) * 100),
  };
}

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
