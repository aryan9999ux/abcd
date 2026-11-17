"use client";
import { useEffect, useState } from "react";

/** null until the browser has answered, so server and first client render match. */
export function useMedia(query: string): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setV(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return v;
}
