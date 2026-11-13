"use client";
import { useEffect, useRef, useState } from "react";
import type { QuotesResponse } from "@/lib/types";
import { POLL_QUOTES_MS } from "./constants";

export interface QuotesState {
  quotes: Record<string, number>;
  source: string | null;
  ts: number | null;
  error: string | null;
}

/** Polls GET /api/quotes (server-authoritative prices). Pauses while the tab is hidden. */
export function useQuotes(symbols: string[]): QuotesState {
  const [state, setState] = useState<QuotesState>({ quotes: {}, source: null, ts: null, error: null });
  const key = symbols.join(",");
  const failures = useRef(0);

  useEffect(() => {
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
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(key)}`, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const json = (await res.json()) as QuotesResponse;
        failures.current = 0;
        if (!stop) setState({ quotes: json.quotes, source: json.source, ts: json.ts, error: null });
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
  }, [key]);

  return state;
}
