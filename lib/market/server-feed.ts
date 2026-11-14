import "server-only";
import { createPriceSource, type PriceSource } from "./source";
import { ALL_SYMBOLS } from "./pricing";
import { instrumentKey, type InstrumentRef } from "../types";
import { ensureInstruments, quoteKeyOf } from "./instruments";
import { fetchQuotes } from "./kite";
import { toTick } from "./zerodha";

/** Starting levels for the DEMO source only (local development). Production never uses it. */
const SEED: Record<string, number> = {
  NIFTY: 24480.35, BANKNIFTY: 52310.1, SENSEX: 80250.6,
  RELIANCE: 1452.2, TCS: 3120.45, HDFCBANK: 1001.6, INFY: 1612.75, SBIN: 842.3,
};
/** A live price older than this is treated as missing, so no order fills on a frozen price. */
const STALE_MS = 15_000;
/** How long a contract keeps being polled after the last time something asked for it. */
const WANT_TTL_MS = 45_000;

export interface Detail { ltp: number; bid?: number; ask?: number; oi?: number; vol?: number; ts: number }
interface Feed { source: PriceSource; spots: Record<string, number>; stamps: Record<string, number>; detail: Map<string, Detail>; wants: Map<string, number>; ts: number; live: boolean }
const g = globalThis as unknown as { __propFeed?: Feed };

/** Process-wide singleton. One upstream connection, many readers (required by Kite's connection limits). */
export function ensureFeed(): Feed {
  if (g.__propFeed) return g.__propFeed;
  const source = createPriceSource();
  const live = source.name !== "demo";
  const now = Date.now();
  const feed: Feed = { source, live, spots: live ? {} : { ...SEED }, stamps: {}, detail: new Map(), wants: new Map(), ts: now };
  if (!live) for (const s of Object.keys(SEED)) feed.stamps[s] = now;
  g.__propFeed = feed;
  const store = (t: { symbol: string; ltp: number; ts: number; bid?: number; ask?: number; oi?: number; vol?: number }) => {
    if (!Number.isFinite(t.ltp) || t.ltp <= 0) return;
    feed.spots[t.symbol] = t.ltp; // contracts share the map, keyed by instrumentKey
    feed.stamps[t.symbol] = t.ts;
    feed.ts = t.ts;
    if (t.symbol.includes("|")) feed.detail.set(t.symbol, { ltp: t.ltp, bid: t.bid, ask: t.ask, oi: t.oi, vol: t.vol, ts: t.ts });
  };
  source.subscribe(ALL_SYMBOLS, store, () => {
    const now2 = Date.now();
    const keys: string[] = [];
    for (const [k, until] of feed.wants) { if (until < now2) feed.wants.delete(k); else keys.push(k); }
    return keys;
  });
  return feed;
}

/** Ask the feed to keep these contracts priced for the next little while. */
export function want(keys: string[], ttlMs = WANT_TTL_MS) {
  const f = ensureFeed();
  const until = Date.now() + ttlMs;
  for (const k of keys) f.wants.set(k, until);
}

function fresh(f: Feed, key: string): number | undefined {
  const p = f.spots[key];
  if (p == null) return undefined;
  if (f.live && Date.now() - (f.stamps[key] ?? 0) > STALE_MS) return undefined;
  return p;
}

export function getSpot(symbol: string): number | undefined {
  return fresh(ensureFeed(), symbol);
}

/** Real price of any instrument, or undefined while the feed has none. */
export function getPrice(ref: InstrumentRef): number | undefined {
  const f = ensureFeed();
  return fresh(f, ref.segment === "EQ" ? ref.underlying : instrumentKey(ref));
}

/** Prices for several symbols and contracts. Contract keys passed here are also kept polled. */
export function getSpots(symbols: string[], contracts: string[] = []): Record<string, number> {
  const f = ensureFeed();
  if (contracts.length) want(contracts);
  const out: Record<string, number> = {};
  for (const s of [...symbols, ...contracts]) {
    const p = fresh(f, s);
    if (p != null) out[s] = Math.round(p * 100) / 100;
  }
  return out;
}

export function getDetail(key: string): Detail | undefined {
  const f = ensureFeed();
  const d = f.detail.get(key);
  return d && Date.now() - d.ts <= STALE_MS ? d : undefined;
}

/**
 * Make sure a contract has a fresh price right now (one direct quote call if the poller has not reached it yet).
 * Used before an order so a first-time contract does not fail just because nobody was watching it.
 */
export async function ensurePrice(ref: InstrumentRef): Promise<number | undefined> {
  const f = ensureFeed();
  const existing = getPrice(ref);
  if (existing != null || ref.segment === "EQ" || !f.live) return existing;
  want([instrumentKey(ref)]);
  try {
    await ensureInstruments();
    const qk = quoteKeyOf(ref);
    if (!qk) return undefined;
    const data = await fetchQuotes([qk]);
    const t = data[qk] ? toTick(instrumentKey(ref), data[qk], Date.now()) : null;
    if (t) {
      f.spots[t.symbol] = t.ltp;
      f.stamps[t.symbol] = t.ts;
      f.detail.set(t.symbol, { ltp: t.ltp, bid: t.bid, ask: t.ask, oi: t.oi, vol: t.vol, ts: t.ts });
    }
  } catch { /* reported by the caller as "no price" */ }
  return getPrice(ref);
}

export const feedName = () => ensureFeed().source.name;

export function feedStats() {
  const f = ensureFeed();
  const liveSymbols = ALL_SYMBOLS.filter((s) => fresh(f, s) != null).length;
  return { source: f.source.name, live: f.live, symbols: ALL_SYMBOLS.length, liveSymbols, lastTickAt: f.live ? (Object.keys(f.spots).length ? f.ts : null) : f.ts, watched: f.wants.size };
}
