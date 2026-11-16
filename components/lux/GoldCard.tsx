"use client";
import { useRef } from "react";

export type Tier = "night" | "violet" | "silver";

/** A funded account drawn as a metal card. Tilts toward the cursor and catches light. */
export default function GoldCard({ tier, size, name, num = "2026", className = "", tilt = true }: { tier: Tier; size: string; name: string; num?: string; className?: string; tilt?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current; if (!el || !tilt) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`); el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`); el.style.setProperty("--ry", `${(x - 0.5) * 18}deg`);
  };
  const leave = () => { const el = ref.current; if (!el) return; ["--rx", "--ry"].forEach((k) => el.style.setProperty(k, "0deg")); };
  return (
    <div ref={ref} className={`gc ${tier} ${className}`} onPointerMove={move} onPointerLeave={leave}>
      <div className="gc-in">
        <div className="gc-top">
          <span className="gc-brand"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m3 17 6-6 4 4 8-9" /></svg>Apex Capital</span>
          <svg className="gc-wave" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M8 7c2.5 3 2.5 7 0 10M12 5c3.7 4.2 3.7 9.8 0 14M16 3c4.8 5.4 4.8 12.6 0 18" /></svg>
        </div>
        <div className="gc-chip" aria-hidden><i /><i /><i /><i /></div>
        <div className="gc-size">{size}</div>
        <div className="gc-bot"><span>Funded account</span><b>{name}</b></div>
        <div className="gc-num">•••• •••• •••• {num}</div>
      </div>
      <i className="gc-sheen" aria-hidden />
    </div>
  );
}
