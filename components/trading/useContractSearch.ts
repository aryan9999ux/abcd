"use client";
import { useEffect, useState } from "react";

export interface Hit { underlying: string; segment: "CE" | "PE" | "FUT"; strike: number | null; expiry: string; lot: number; key: string; ltp: number | null }

/** Looks up option contracts for text like "25700 PE". Waits 160ms after typing stops, and ignores answers that arrive late. */
export function useContractSearch(q: string): { hits: Hit[]; busy: boolean; ready: boolean } {
  const [state, setState] = useState<{ q: string; hits: Hit[]; ready: boolean }>({ q: "", hits: [], ready: true });
  const text = q.trim();
  const wanted = /\d|\b(ce|pe|call|put)\b/i.test(text);
  useEffect(() => {
    if (!wanted) return;
    let stop = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`, { cache: "no-store" });
        const j = (await res.json()) as { ok: boolean; hits?: Hit[]; ready?: boolean };
        if (!stop && j.ok) setState({ q: text, hits: j.hits ?? [], ready: j.ready !== false });
      } catch { /* the next keystroke tries again */ }
    }, 160);
    return () => { stop = true; clearTimeout(t); };
  }, [text, wanted]);
  if (!wanted) return { hits: [], busy: false, ready: true };
  return { hits: state.q === text ? state.hits : [], busy: state.q !== text, ready: state.ready };
}
