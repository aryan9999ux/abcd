/**
 * Price-source interface. The terminal and trading engine depend only on this,
 * so the data vendor (Zerodha today, a licensed vendor later) can be swapped in one place.
 * `symbol` is an underlying ("NIFTY") or an instrumentKey ("NIFTY|CE|24500|2026-11-17").
 */
export type Tick = { symbol: string; ltp: number; ts: number; bid?: number; ask?: number; oi?: number; vol?: number };

export interface PriceSource {
  readonly name: string;
  /** `extra` returns the instrumentKeys of contracts that currently need prices (open positions, chains being viewed). */
  subscribe(symbols: string[], onTick: (t: Tick) => void, extra?: () => string[]): void;
  close(): void;
}

export function createPriceSource(): PriceSource {
  // Demo prices are for local development only. A production server always uses the real feed.
  const demo = process.env.PRICE_SOURCE === "demo" && process.env.NODE_ENV !== "production";
  if (!demo) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ZerodhaSource } = require("./zerodha");
    return new ZerodhaSource();
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DemoSource } = require("./demo");
  return new DemoSource();
}
