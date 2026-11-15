"use client";
import { useEffect, useRef } from "react";

function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/** A drawing of the terminal for the home page. Shapes only: no prices, no results, never presented as real data. */
export default function HeroPreview() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth, h = c.clientHeight;
      if (!w || !h) return;
      c.width = w * dpr; c.height = h * dpr;
      const x = c.getContext("2d")!;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, w, h);
      const r = rng(7), n = 46, up = css("--up"), dn = css("--down"), line = css("--line");
      for (let k = 1; k < 5; k++) { x.strokeStyle = line; x.beginPath(); x.moveTo(0, (h * k) / 5); x.lineTo(w, (h * k) / 5); x.stroke(); }
      let p = 0.55;
      const bars: [number, number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const o = p; p += (r() - 0.46) * 0.08; const cl = p;
        bars.push([o, Math.max(o, cl) + r() * 0.03, Math.min(o, cl) - r() * 0.03, cl]);
      }
      const lo = Math.min(...bars.map((b) => b[2])), hi = Math.max(...bars.map((b) => b[1]));
      const sy = (v: number) => h - 14 - ((h - 28) * (v - lo)) / (hi - lo);
      const bw = (w - 16) / n;
      bars.forEach(([o, hh, l, cl], i) => {
        const col = cl >= o ? up : dn, cx = 8 + i * bw + bw / 2;
        x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx, sy(hh)); x.lineTo(cx, sy(l)); x.stroke();
        x.fillRect(cx - bw * 0.3, Math.min(sy(o), sy(cl)), bw * 0.6, Math.max(1.5, Math.abs(sy(o) - sy(cl))));
      });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    window.addEventListener("themechange", draw);
    return () => { ro.disconnect(); window.removeEventListener("themechange", draw); };
  }, []);

  return (
    <div className="mock" aria-label="Illustration of the trading terminal">
      <div className="tb"><i /><i /><i /><span>Terminal</span></div>
      <div className="body">
        <div className="wl">
          {["NIFTY", "BANKNIFTY", "SENSEX", "RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN"].map((s, i) => (
            <div key={s} className={i === 0 ? "on" : ""}><b>{s}</b><small>{i < 3 ? "F&O" : "5×"}</small></div>
          ))}
        </div>
        <div className="main">
          <div className="hd"><b>NIFTY FUT</b><span className="muted">Chart · Option chain</span></div>
          <canvas className="ch" ref={ref} />
          <div className="ord"><span className="b">BUY</span><span className="s">SELL</span></div>
        </div>
      </div>
      <div className="note">Illustration of the layout. Not live data or results.</div>
    </div>
  );
}
