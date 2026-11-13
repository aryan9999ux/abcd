import "server-only";
import { createPriceSource, type PriceSource } from "./source";
import { ALL_SYMBOLS } from "./pricing";

/** Starting levels used until the first tick arrives (same as the demo source). */
const SEED: Record<string, number> = {
  NIFTY: 24480.35, BANKNIFTY: 52310.1, SENSEX: 80250.6,
  RELIANCE: 1452.2, TCS: 3120.45, HDFCBANK: 1001.6, INFY: 1612.75, SBIN: 842.3,
};

interface Feed { source: PriceSource; spots: Record<string, number>; ts: number }
const g = globalThis as unknown as { __propFeed?: Feed };

/** Process-wide singleton. One upstream connection, many readers (required by Kite's 3-connection cap). */
export function ensureFeed(): Feed {
  if (g.__propFeed) return g.__propFeed;
  const source = createPriceSource();
  const feed: Feed = { source, spots: { ...SEED }, ts: Date.now() };
  g.__propFeed = feed;
  source.subscribe(ALL_SYMBOLS, (t) => {
    if (Number.isFinite(t.ltp) && t.ltp > 0) {
      feed.spots[t.symbol] = t.ltp;
      feed.ts = t.ts;
    }
  });
  return feed;
}

export function getSpot(symbol: string): number | undefined {
  return ensureFeed().spots[symbol];
}

export function getSpots(symbols: string[]): Record<string, number> {
  const f = ensureFeed();
  const out: Record<string, number> = {};
  for (const s of symbols) if (f.spots[s] != null) out[s] = Math.round(f.spots[s] * 100) / 100;
  return out;
}

export const feedName = () => ensureFeed().source.name;
