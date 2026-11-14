import "server-only";
import type { PriceSource, Tick } from "./source";
import { fetchQuotes, kiteKey, kiteSession, noteError, noteOk, type KiteQuote } from "./kite";
import { ensureInstruments, quoteKeyOf } from "./instruments";
import { parseInstrumentKey } from "../types";

/**
 * Zerodha Kite Connect price source. One /quote call about every 1.2 seconds covers the 8 underlyings plus
 * every contract that currently needs a price (open positions and the option chain being viewed).
 * Does nothing until the admin has connected today.
 *
 * Kite's terms restrict redistribution and public display of live data and list mock-trading apps as a
 * prohibited use. Zerodha can revoke access. Everything depends only on the PriceSource interface.
 */
const POLL_MS = 1200;
const MAX_KEYS = 480;

export function toTick(symbol: string, q: KiteQuote, ts: number): Tick | null {
  const bid = q.depth?.buy?.[0]?.price, ask = q.depth?.sell?.[0]?.price;
  let ltp = q.last_price ?? 0;
  if (!(ltp > 0) && bid && ask && bid > 0 && ask > 0) ltp = (bid + ask) / 2; // untraded contract: use the live market
  if (!(ltp > 0)) return null;
  return { symbol, ltp, ts, bid: bid || undefined, ask: ask || undefined, oi: q.oi, vol: q.volume };
}

export class ZerodhaSource implements PriceSource {
  readonly name = "zerodha";
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;

  subscribe(symbols: string[], onTick: (t: Tick) => void, extra?: () => string[]): void {
    const poll = async () => {
      if (this.busy || !kiteSession()) return;
      this.busy = true;
      try {
        await ensureInstruments();
        const map = new Map<string, string>(); // kite key -> our key
        for (const s of symbols) map.set(kiteKey(s), s);
        for (const k of extra?.() ?? []) {
          if (map.size >= MAX_KEYS) break;
          const q = quoteKeyOf(parseInstrumentKey(k));
          if (q) map.set(q, k);
        }
        const data = await fetchQuotes([...map.keys()]);
        const ts = Date.now();
        for (const [kk, ours] of map) {
          const t = data[kk] ? toTick(ours, data[kk], ts) : null;
          if (t) onTick(t);
        }
        noteOk();
      } catch (e) {
        noteError(e instanceof Error ? e.message : String(e));
      } finally {
        this.busy = false;
      }
    };
    this.timer = setInterval(() => void poll(), POLL_MS);
    this.timer.unref?.();
    void poll();
  }

  close(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
