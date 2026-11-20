import "server-only";
import type { PriceSource, Tick } from "./source";
import { fetchQuotes, kiteKey, kiteSession, restoreSession, noteError, noteOk, type KiteQuote } from "./kite";
import { ensureInstruments, quoteKeyOf, spotToken, instOf } from "./instruments";
import { KiteStream, type WsTick } from "./kite-ws";
import { parseInstrumentKey } from "../types";

/**
 * Zerodha Kite Connect price source. One /quote call about every 1.2 seconds covers the 8 underlyings plus
 * every contract that currently needs a price (open positions and the option chain being viewed).
 * Does nothing until the admin has connected today.
 *
 * On top of that a Kite WebSocket pushes every trade tick the moment it happens. While the socket is healthy the
 * quote call only runs every few seconds, to refresh untraded contracts and reconcile; if the socket drops, the
 * 1.2 s polling takes over again by itself.
 *
 * Kite's terms restrict redistribution and public display of live data and list mock-trading apps as a
 * prohibited use. Zerodha can revoke access. Everything depends only on the PriceSource interface.
 */
const POLL_MS = 1200;
const MAX_KEYS = 480;
const REST_WHEN_STREAMING_MS = 5000;

export function toTick(symbol: string, q: KiteQuote, ts: number): Tick | null {
  const bid = q.depth?.buy?.[0]?.price, ask = q.depth?.sell?.[0]?.price;
  let ltp = q.last_price ?? 0;
  if (!(ltp > 0) && bid && ask && bid > 0 && ask > 0) ltp = (bid + ask) / 2; // untraded contract: use the live market
  if (!(ltp > 0)) return null;
  return { symbol, ltp, ts, bid: bid || undefined, ask: ask || undefined, oi: q.oi, vol: q.volume, close: q.ohlc?.close || undefined };
}

export class ZerodhaSource implements PriceSource {
  readonly name = "zerodha";
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;

  private stream?: KiteStream;
  private tokenKey = new Map<number, string>(); // instrument token -> our key
  private lastRest = 0;

  subscribe(symbols: string[], onTick: (t: Tick) => void, extra?: () => string[]): void {
    const onWs = (ticks: WsTick[]) => {
      const ts = Date.now();
      for (const w of ticks) {
        const key = this.tokenKey.get(w.token);
        if (key) onTick({ symbol: key, ltp: w.ltp, ts, bid: w.bid, ask: w.ask, oi: w.oi, vol: w.vol, close: w.close });
      }
    };
    this.stream = new KiteStream(() => {
      const s = kiteSession();
      return s && process.env.KITE_API_KEY ? { apiKey: process.env.KITE_API_KEY, accessToken: s.accessToken } : undefined;
    }, { onTicks: onWs });
    this.stream.start();

    const poll = async () => {
      if (this.busy) return;
      this.busy = true;
      try {
        if (!kiteSession()) await restoreSession();
        if (!kiteSession()) return;
        await ensureInstruments();
        const map = new Map<string, string>(); // kite key -> our key
        const toks = new Map<number, string>();
        for (const s of symbols) {
          map.set(kiteKey(s), s);
          const t = spotToken(s);
          if (t) toks.set(t, s);
        }
        for (const k of extra?.() ?? []) {
          if (map.size >= MAX_KEYS) break;
          const ref = parseInstrumentKey(k);
          const q = quoteKeyOf(ref);
          if (q) map.set(q, k);
          const t = instOf(ref)?.token;
          if (t) toks.set(t, k);
        }
        this.tokenKey = toks;
        this.stream?.setTokens([...toks.keys()]);
        const streaming = !!this.stream?.up && Date.now() - this.stream.lastFrame < 4000;
        if (streaming && Date.now() - this.lastRest < REST_WHEN_STREAMING_MS) return;
        this.lastRest = Date.now();
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
    this.stream?.stop();
  }
}
