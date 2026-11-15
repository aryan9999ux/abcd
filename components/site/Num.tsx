"use client";
import { useEffect, useRef, useState } from "react";

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const calm = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts up from 0 the first time it scrolls into view. Final value is the server-rendered one. */
export function CountUp({ to, suffix = "", prefix = "", ms = 1200 }: { to: number; suffix?: string; prefix?: string; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el || calm() || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / ms);
        setV(Math.round(to * ease(p)));
        if (p < 1) requestAnimationFrame(tick);
      };
      setV(0);
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, ms]);
  return <span ref={ref}>{prefix}{v}{suffix}</span>;
}

/** Glides to a new value instead of jumping. */
export function Tween({ value, format }: { value: number; format: (n: number) => string }) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (calm()) { setV(value); from.current = value; return; }
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 420);
      const cur = a + (value - a) * ease(p);
      from.current = cur;
      setV(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(v)}</>;
}
