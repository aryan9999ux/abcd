/**
 * Instrument pricing, margin and expiry rules. Pure and isomorphic: used by the browser for display
 * and by the trading engine for every fill, so keep it free of server-only imports.
 * Option premiums are simulated (Black-Scholes, skewed IV), not exchange prices.
 */
import type { InstrumentRef, Side } from "../types";
import { FNO_MARGIN_RATE, INDEX_CONTRACTS, STOCK_LEVERAGE } from "./fno";

const IST_MS = 330 * 60 * 1000;
const MARKET_CLOSE_IST_MIN = 15 * 60 + 30;
const RATE = 0.065;

export const INDEX_SYMBOLS = Object.keys(INDEX_CONTRACTS) as string[];
export const STOCK_SYMBOLS = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN"] as const;
export const ALL_SYMBOLS: string[] = [...INDEX_SYMBOLS, ...STOCK_SYMBOLS];

type Contract = { lot: number; strikeStep: number };
const contractOf = (u: string): Contract | undefined => (INDEX_CONTRACTS as Record<string, Contract>)[u];

export const isIndex = (u: string) => contractOf(u) !== undefined;
export const isStock = (u: string) => (STOCK_SYMBOLS as readonly string[]).includes(u);

export function lotSize(underlying: string): number {
  return contractOf(underlying)?.lot ?? 1;
}
export function strikeStep(underlying: string): number {
  return contractOf(underlying)?.strikeStep ?? 1;
}

/* ---------- expiries (IST calendar, no holiday adjustment) ---------- */

function istParts(now: number) {
  const d = new Date(now + IST_MS);
  return { d, minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
const fmt = (d: Date) => d.toISOString().slice(0, 10);

/** Next `count` dates falling on `weekday` (0 = Sunday). Today counts until the 15:30 IST close. */
function weekly(now: number, weekday: number, count: number): string[] {
  const { d, minutes } = istParts(now);
  const cur = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const out: string[] = [];
  for (let i = 0; out.length < count && i < 40; i++) {
    if (cur.getUTCDay() === weekday && !(i === 0 && minutes >= MARKET_CLOSE_IST_MIN)) out.push(fmt(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Last `weekday` of each upcoming month, next `count` that are still live. */
function monthlyLast(now: number, weekday: number, count: number): string[] {
  const { d, minutes } = istParts(now);
  const today = fmt(d);
  const out: string[] = [];
  for (let m = 0; out.length < count && m < 6; m++) {
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m + 1, 0));
    while (last.getUTCDay() !== weekday) last.setUTCDate(last.getUTCDate() - 1);
    const s = fmt(last);
    if (s > today || (s === today && minutes < MARKET_CLOSE_IST_MIN)) out.push(s);
  }
  return out;
}

/**
 * Expiry weekdays follow fno.ts (NIFTY weekly Tuesday, BANKNIFTY monthly, SENSEX weekly Thursday).
 * Exchange circulars change these. Verify before launch.
 */
export function expiriesFor(underlying: string, now = Date.now()): string[] {
  switch (underlying) {
    case "NIFTY": return weekly(now, 2, 2);
    case "BANKNIFTY": return monthlyLast(now, 2, 2);
    case "SENSEX": return weekly(now, 4, 2);
    default: return [];
  }
}

/** underlying -> upcoming expiries. Getters recompute on every read so a long-running server never goes stale. */
export const EXPIRIES: Record<string, string[]> = (() => {
  const o: Record<string, string[]> = {};
  for (const u of INDEX_SYMBOLS) Object.defineProperty(o, u, { enumerable: true, get: () => expiriesFor(u) });
  return o;
})();

/* ---------- pricing ---------- */

const round2 = (n: number) => Math.round(n * 100) / 100;

function ncdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** Years to the 15:30 IST close on the expiry date, floored at a quarter of a day. */
function yearsTo(expiry: string, now: number): number {
  const e = Date.parse(`${expiry}T15:30:00+05:30`);
  return Math.max((e - now) / (365 * 864e5), 1 / 365 / 4);
}

const ivAt = (S: number, K: number) => 0.13 + Math.abs(Math.log(K / S)) * 0.9;

function bs(type: "CE" | "PE", S: number, K: number, T: number, sig: number) {
  const sq = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (RATE + (sig * sig) / 2) * T) / (sig * sq);
  const d2 = d1 - sig * sq;
  if (type === "CE") return { p: Math.max(0.05, S * ncdf(d1) - K * Math.exp(-RATE * T) * ncdf(d2)), d: ncdf(d1) };
  return { p: Math.max(0.05, K * Math.exp(-RATE * T) * ncdf(-d2) - S * ncdf(-d1)), d: ncdf(d1) - 1 };
}

export function priceInstrument(ref: InstrumentRef, spot: number, now = Date.now()): number {
  if (ref.segment === "EQ") return round2(spot);
  if (!ref.expiry) return round2(spot);
  const T = yearsTo(ref.expiry, now);
  if (ref.segment === "FUT") return round2(spot * (1 + (0.0006 * Math.max(1, T * 365)) / 7));
  if (ref.strike == null) return round2(spot);
  const p = bs(ref.segment, spot, ref.strike, T, ivAt(spot, ref.strike)).p;
  return round2(Math.round(p / 0.05) * 0.05);
}

export function optionGreeks(ref: InstrumentRef, spot: number, now = Date.now()): { iv: number; delta: number } {
  if ((ref.segment !== "CE" && ref.segment !== "PE") || ref.strike == null || !ref.expiry) return { iv: 0, delta: 1 };
  const iv = ivAt(spot, ref.strike);
  return { iv, delta: bs(ref.segment, spot, ref.strike, yearsTo(ref.expiry, now), iv).d };
}

/**
 * Margin to open `qty` units. Stocks: notional / 5 (intraday leverage). Futures and short options: 12% of spot x qty.
 * Long options: full premium. Sample model, replace with a SPAN-style rule before launch.
 */
export function marginRequired(ref: InstrumentRef, side: Side, qty: number, price: number, spot: number): number {
  if (ref.segment === "EQ") return (price * qty) / STOCK_LEVERAGE;
  if (ref.segment === "FUT") return spot * qty * FNO_MARGIN_RATE;
  return side === "Buy" ? price * qty : spot * qty * FNO_MARGIN_RATE;
}
