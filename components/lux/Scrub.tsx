"use client";
import { useEffect, useRef, useState } from "react";
import GoldCard from "./GoldCard";

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/** Pinned scroll scene: you pay, you command, you keep. Scroll drives it. */
export default function Scrub({ fee, top, split }: { fee: string; top: string; split: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = ref.current; if (!el) return;
        const r = el.getBoundingClientRect();
        setP(clamp(-r.top / Math.max(1, r.height - window.innerHeight), 0, 1));
      });
    };
    on(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  const beats = [
    { c: 0.16, k: "You pay", big: fee, sub: "One time. That is the whole risk." },
    { c: 0.5, k: "You command", big: top, sub: "of buying power on live NSE and BSE prices." },
    { c: 0.84, k: "You keep", big: `${split}%`, sub: "of every profit. Your fee comes back with rewards." },
  ];
  return (
    <div className="scrub" ref={ref}>
      <div className="stage">
        <div className="sc-card" style={{ transform: `translate(-50%, -50%) scale(${1.0 + p * 0.7}) rotate(${-10 + p * 10}deg)`, opacity: 0.1 + Math.sin(p * Math.PI) * 0.22 }} aria-hidden>
          <GoldCard tier="gold" size={top} name="Funded" tilt={false} />
        </div>
        {beats.map((b, i) => {
          const o = clamp(1 - Math.abs(p - b.c) / 0.2, 0, 1);
          return (
            <div key={b.k} className="beat" style={{ opacity: o, transform: `translateY(${(b.c - p) * 160}px) scale(${0.94 + o * 0.06})`, filter: `blur(${(1 - o) * 10}px)`, pointerEvents: o > 0.5 ? "auto" : "none" }}>
              <span className="k">{b.k}</span>
              <b className="big">{b.big}</b>
              <p>{b.sub}</p>
            </div>
          );
        })}
        <div className="dots" aria-hidden>{beats.map((b, i) => <i key={i} className={Math.abs(p - b.c) < 0.17 ? "on" : ""} />)}</div>
      </div>
    </div>
  );
}
