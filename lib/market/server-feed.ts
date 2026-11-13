import "server-only";
import { createPriceSource, type PriceSource } from "./source";
import { ALL_SYMBOLS } from "./pricing";

/** Starting levels for the DEMO source only. A live source never uses invented prices. */
const SEED: Record<string, number> = {
  NIFTY: 24480.35, BANKNIFTY: 52310.1, SENSEX: 80250.6,
  RELIANCE: 1452.2, TCS: 3120.45, HDFCBANK: 1001.6, INFY: 1612.75, SBIN: 842.3,
};
/** A live price older than this is treated as missing, so no order fills on a frozen price. */
const STALE_MS = 15_000;

interface Feed { source: PriceSource; spots: Record<string, number>; stamps: Record<string, number>; ts: number; live: boolean }
const g = globalThis as unknown as { __propFeed?: Feed };

/** Process-wide singleton. One upstream connection, many readers (required by Kite's connection limits). */
export function ensureFeed(): Feed {
  if (g.__propFeed) return g.__propFeed;
  const source = createPriceSource();
  const live = source.name !== "demo";
  const now = Date.now();
  const feed: Feed = { source, live, spots: live ? {} : { ...SEED }, stamps: {}, ts: now };
  if (!live) for (const s of Object.keys(SEED)) feed.stamps[s] = now;
  g.__propFeed = feed;
  source.subscribe(ALL_SYMBOLS, (t) => {
    if (Number.isFinite(t.ltp) && t.ltp > 0) {
      feed.spots[t.symbol] = t.ltp;
      feed.stamps[t.symbol] = t.ts;
      feed.ts = t.ts;
    }
  });
  return feed;
}

function fresh(f: Feed, symbol: string): number | undefined {
  const p = f.spots[symbol];
  if (p == null) return undefined;
  if (f.live && Date.now() - (f.stamps[symbol] ?? 0) > STALE_MS) return undefined;
  return p;
}

export function getSpot(symbol: string): number | undefined {
  return fresh(ensureFeed(), symbol);
}

export function getSpots(symbols: string[]): Record<string, number> {
  const f = ensureFeed();
  const out: Record<string, number> = {};
  for (const s of symbols) {
    const p = fresh(f, s);
    if (p != null) out[s] = Math.round(p * 100) / 100;
  }
  return out;
}

export const feedName = () => ensureFeed().source.name;

export function feedStats() {
  const f = ensureFeed();
  const liveSymbols = ALL_SYMBOLS.filter((s) => fresh(f, s) != null).length;
  return { source: f.source.name, live: f.live, symbols: ALL_SYMBOLS.length, liveSymbols, lastTickAt: f.live ? (Object.keys(f.spots).length ? f.ts : null) : f.ts };
}
