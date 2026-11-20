"use client";
import { useCallback, useEffect, useState } from "react";
import { WATCHLIST } from "./constants";

const KEY = "edge-watchlist-v1";
const DEFAULT = WATCHLIST.map((w) => w.k);

/** The trader's own watchlist: underlyings ("NIFTY") and option/futures contracts (instrument keys). Saved in this browser. */
export function useWatchlist() {
  const [keys, setKeys] = useState<string[]>(DEFAULT);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const v = JSON.parse(raw); if (Array.isArray(v) && v.every((x) => typeof x === "string")) setKeys(v.slice(0, 60)); }
    } catch { /* storage blocked: the default list is used */ }
  }, []);
  const save = useCallback((next: string[]) => {
    setKeys(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  }, []);
  const has = useCallback((k: string) => keys.includes(k), [keys]);
  const add = useCallback((k: string) => { if (!keys.includes(k)) save([...keys, k].slice(0, 60)); }, [keys, save]);
  const remove = useCallback((k: string) => save(keys.filter((x) => x !== k)), [keys, save]);
  const toggle = useCallback((k: string) => (keys.includes(k) ? remove(k) : add(k)), [keys, add, remove]);
  const reset = useCallback(() => save(DEFAULT), [save]);
  return { keys, has, add, remove, toggle, reset };
}
