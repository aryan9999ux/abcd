"use client";
import { useEffect, useRef } from "react";

function rng(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
type Bar = [number, number, number, number]; // o h l c

const SPARK = ["M0 14 8 11 16 12 24 7 32 9 40 4", "M0 6 8 9 16 7 24 12 32 10 40 15", "M0 12 8 8 16 10 24 5 32 7 40 3", "M0 9 8 12 16 8 24 10 32 6 40 8", "M0 13 8 10 16 11 24 6 32 8 40 5", "M0 8 8 6 16 10 24 9 32 13 40 11"];

/** An animated drawing of the terminal. Shapes only: no prices, no results, never presented as real data. */
export default function HeroPreview() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = rng(11), n = 44;
    const next = (prev: number): Bar => {
      const o = prev, cl = o + (r() - 0.45) * 0.07;
      return [o, Math.max(o, cl) + r() * 0.025, Math.min(o, cl) - r() * 0.025, cl];
    };
    const bars: Bar[] = [];
    let p = 0.5;
    for (let i = 0; i < n + 2; i++) { const b = next(p); bars.push(b); p = b[3]; }
    const start = performance.now();
    let last = start, shift = 0, raf = 0, w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => { w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(c);

    const frame = (now: number) => {
      if (!w || !h) { raf = requestAnimationFrame(frame); return; }
      const x = c.getContext("2d")!;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, w, h);
      const up = css("--up"), dn = css("--down"), line = css("--line"), acc = css("--accent");
      const reveal = calm ? 1 : Math.min(1, (now - start) / 2200);
      if (!calm && now - last > 1100 && reveal >= 1) { const l = bars[bars.length - 1][3]; bars.push(next(l)); bars.shift(); last = now; shift = 1; }
      shift = calm ? 0 : Math.max(0, shift - 0.045);
      for (let k = 1; k < 5; k++) { x.strokeStyle = line; x.beginPath(); x.moveTo(0, (h * k) / 5); x.lineTo(w, (h * k) / 5); x.stroke(); }
      const vis = bars.slice(1, n + 1);
      const wob = calm ? 0 : Math.sin(now / 340) * 0.006;
      const lo = Math.min(...vis.map((b) => b[2])), hi = Math.max(...vis.map((b) => b[1]));
      const sy = (v: number) => h - 22 - ((h - 52) * (v - lo)) / (hi - lo);
      const bw = (w - 64) / n;
      const count = Math.floor(vis.length * reveal);
      for (let i = 0; i < count; i++) {
        let [o, hh, l, cl] = vis[i];
        if (i === vis.length - 1) { cl += wob; hh = Math.max(hh, cl); l = Math.min(l, cl); }
        const col = cl >= o ? up : dn, cx = 8 + (i + shift) * bw + bw / 2;
        x.globalAlpha = i === count - 1 && reveal < 1 ? 0.5 : 1;
        x.strokeStyle = col; x.fillStyle = col;
        x.beginPath(); x.moveTo(cx, sy(hh)); x.lineTo(cx, sy(l)); x.stroke();
        x.fillRect(cx - bw * 0.32, Math.min(sy(o), sy(cl)), bw * 0.64, Math.max(1.5, Math.abs(sy(o) - sy(cl))));
        x.globalAlpha = 0.18;
        x.fillRect(cx - bw * 0.32, h - 8 - ((i * 37) % 11) - 3, bw * 0.64, ((i * 37) % 11) + 3);
        x.globalAlpha = 1;
      }
      if (count > 0) {
        const lastB = vis[Math.min(count, vis.length) - 1], ly = sy(lastB[3] + wob);
        x.setLineDash([3, 4]); x.strokeStyle = acc; x.beginPath(); x.moveTo(0, ly); x.lineTo(w - 54, ly); x.stroke(); x.setLineDash([]);
        x.fillStyle = acc; x.fillRect(w - 54, ly - 9, 50, 18);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div className="mockwrap">
      <div className="mock" aria-label="Illustration of the trading terminal">
        <div className="tb"><i /><i /><i /><span>Terminal</span></div>
        <div className="body">
          <div className="wl">
            {["NIFTY", "BANKNIFTY", "SENSEX", "RELIANCE", "TCS", "HDFCBANK"].map((s, i) => (
              <div key={s} className={i === 0 ? "on" : ""}>
                <b>{s}</b>
                <svg viewBox="0 0 40 18" width="34" height="14" aria-hidden="true"><path d={SPARK[i]} pathLength="1" style={{ animationDelay: `${0.5 + i * 0.12}s` }} className={i % 3 === 1 ? "dn" : ""} /></svg>
              </div>
            ))}
          </div>
          <div className="main">
            <div className="hd"><b>NIFTY FUT</b><span className="muted">Chart · Option chain</span><span className="live"><i />Live</span></div>
            <canvas className="ch" ref={ref} />
            <div className="ord"><span className="b">BUY</span><span className="s">SELL</span></div>
          </div>
        </div>
        <div className="note">Illustration of the layout. Not live data or results.</div>
      </div>
      <div className="chip c1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>Stop loss on every trade</div>
      <div className="chip c2"><span>Daily loss limit</span><i><b /></i></div>
    </div>
  );
}
