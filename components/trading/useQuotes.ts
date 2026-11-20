"use client";
import { useEffect, useRef, useState } from "react";
import type { QuotesResponse } from "@/lib/types";
import { POLL_QUOTES_MS } from "./constants";

export interface QuotesState {
  quotes: Record<string, number>;
  /** Previous session close per key. */
  prev: Record<string, number>;
  source: string | null;
  ts: number | null;
  error: string | null;
  /** True once the exchange contract list is loaded server-side. */
  ready: boolean;
}

/** Live prices over a push stream (/api/stream). Falls back to polling /api/quotes if the stream is unavailable. */
export function useQuotes(symbols: string[], instruments: string[] = []): QuotesState {
  const [state, setState] = useState<QuotesState>({ quotes: {}, prev: {}, source: null, ts: null, error: null, ready: false });
  const key = symbols.join(",");
  const ikey = [...new Set(instruments)].sort().join(",");
  const failures = useRef(0);

  // Live push: a stream of ticks. If it cannot connect, the polling loop below carries on.
  const [pushing, setPushing] = useState(true);
  useEffect(() => {
    if (!pushing) return;
    let es: EventSource | null = null;
    let fails = 0;
    let wasOpen = false;
    const url = `/api/stream?symbols=${encodeURIComponent(key)}${ikey ? `&instruments=${encodeURIComponent(ikey)}` : ""}`;
    es = new EventSource(url);
    es.onopen = () => { wasOpen = true; fails = 0; };
    es.addEventListener("snap", (e) => {
      const j = JSON.parse((e as MessageEvent).data) as QuotesResponse;
      setState((s) => ({ quotes: { ...s.quotes, ...j.quotes }, prev: { ...s.prev, ...(j.prev ?? {}) }, source: j.source, ts: j.ts, error: null, ready: !!j.ready }));
    });
    es.addEventListener("t", (e) => {
      const j = JSON.parse((e as MessageEvent).data) as { ts: number; quotes: Record<string, number> };
      setState((s) => ({ ...s, quotes: { ...s.quotes, ...j.quotes }, ts: j.ts, error: null }));
    });
    es.onerror = () => {
      fails += 1;
      // never connected (or keeps failing): fall back to polling rather than showing frozen prices
      if (!wasOpen || fails >= 3) { es?.close(); es = null; setPushing(false); }
    };
    return () => { es?.close(); };
  }, [key, ikey, pushing]);

  useEffect(() => {
    if (pushing) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const ctrl = new AbortController();

    async function load() {
      if (stop) return;
      if (document.hidden) {
        timer = setTimeout(load, POLL_QUOTES_MS);
        return;
      }
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(key)}${ikey ? `&instruments=${encodeURIComponent(ikey)}` : ""}`, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const json = (await res.json()) as QuotesResponse;
        failures.current = 0;
        if (!stop) setState({ quotes: json.quotes, prev: json.prev ?? {}, source: json.source, ts: json.ts, error: null, ready: !!json.ready });
      } catch (e) {
        if (stop || (e instanceof DOMException && e.name === "AbortError")) return;
        failures.current += 1;
        setState((s) => ({ ...s, error: "Prices are not updating. Retrying." }));
      }
      timer = setTimeout(load, Math.min(POLL_QUOTES_MS * (1 + failures.current), 8000));
    }
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [key, ikey, pushing]);

  return state;
}
