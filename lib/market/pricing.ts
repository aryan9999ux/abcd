/**
 * Instrument pricing, margin and expiry rules. Pure and isomorphic: used by the browser for display
 * and by the trading engine for every fill, so keep it free of server-only imports.
 */
import type { InstrumentRef, Side } from "../types";
import { instrumentKey } from "../types";
import { FNO_MARGIN_RATE, INDEX_CONTRACTS, STOCK_LEVERAGE } from "./fno";

export const INDEX_SYMBOLS = Object.keys(INDEX_CONTRACTS) as string[];
export const STOCK_SYMBOLS = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN"] as const;
export const ALL_SYMBOLS: string[] = [...INDEX_SYMBOLS, ...STOCK_SYMBOLS];

export const isIndex = (u: string) => (INDEX_SYMBOLS as string[]).includes(u);
export const isStock = (u: string) => (STOCK_SYMBOLS as readonly string[]).includes(u);


/** Exchange contract facts for one underlying, loaded from the real contract list (see instruments.ts). */
export interface ContractSpec {
  lot: number;
  strikeStep: number;
  futExpiries: string[];
  optExpiries: string[];
}

export const expiriesOf = (spec: ContractSpec | undefined, segment: "FUT" | "CE" | "PE"): string[] =>
  !spec ? [] : segment === "FUT" ? spec.futExpiries : spec.optExpiries;

/**
 * Real prices only. `quotes` holds spot by symbol ("NIFTY") and contract prices by instrumentKey
 * ("NIFTY|CE|24500|2026-11-17"), all from the exchange feed. Returns undefined while a price is missing;
 * nothing is ever modelled or invented.
 */
export function priceOf(ref: InstrumentRef, quotes: Record<string, number>): number | undefined {
  const p = ref.segment === "EQ" ? quotes[ref.underlying] : quotes[instrumentKey(ref)];
  return typeof p === "number" && p > 0 ? p : undefined;
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
