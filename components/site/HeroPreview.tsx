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

function sample() {
  const r = rng(21);
  const a = [100000];
  for (let i = 1; i < 40; i++) a.push(a[i - 1] * (1 + (r() - 0.5) * 0.011 + 0.0012));
  const k = 104200 / a[a.length - 1];
  return a.map((v) => v * k);
}

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/** Illustrative equity curve. Sample data only, never presented as real results. */
export default function HeroPreview() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const data = sample();
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth, h = c.clientHeight;
      if (!w || !h) return;
      c.width = w * dpr;
      c.height = h * dpr;
      const x = c.getContext("2d")!;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, w, h);
      const base = 100000;
      let mn = Math.min(...data, base), mx = Math.max(...data, base);
      const pad = (mx - mn) * 0.12;
      mn -= pad; mx += pad;
      const R = w - 54, T = 8, B = h - 8;
      const sx = (i: number) => (R * i) / (data.length - 1);
      const sy = (v: number) => B - ((B - T) * (v - mn)) / (mx - mn);
      const col = css("--up"), mut = css("--muted"), line = css("--line");
      x.font = "11px " + (css("--f-mono") || "monospace");
      x.textBaseline = "middle";
      for (let k = 0; k <= 3; k++) {
        const v = mn + ((mx - mn) * k) / 3, y = sy(v);
        x.strokeStyle = line; x.lineWidth = 1;
        x.beginPath(); x.moveTo(0, y); x.lineTo(R, y); x.stroke();
        x.fillStyle = mut; x.fillText("₹" + Math.round(v / 1000) + "k", R + 6, y);
      }
      x.setLineDash([4, 4]); x.strokeStyle = mut;
      x.beginPath(); x.moveTo(0, sy(base)); x.lineTo(R, sy(base)); x.stroke(); x.setLineDash([]);
      const g = x.createLinearGradient(0, T, 0, B);
      x.fillStyle = col;
      x.beginPath();
      data.forEach((v, i) => (i ? x.lineTo(sx(i), sy(v)) : x.moveTo(sx(i), sy(v))));
      x.strokeStyle = col; x.lineWidth = 2; x.lineJoin = "round"; x.stroke();
      x.lineTo(sx(data.length - 1), B); x.lineTo(0, B); x.closePath();
      g.addColorStop(0, "rgba(52,211,153,.28)"); g.addColorStop(1, "rgba(52,211,153,0)");
      x.fillStyle = g; x.fill();
      x.beginPath(); x.arc(sx(data.length - 1), sy(data[data.length - 1]), 4, 0, 7); x.fillStyle = col; x.fill();
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    window.addEventListener("themechange", draw);
    const mq = matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", draw);
    return () => {
      ro.disconnect();
      window.removeEventListener("themechange", draw);
      mq.removeEventListener("change", draw);
    };
  }, []);

  return (
    <div className="phone glass" aria-label="Sample account preview">
      <div className="row">
        <span className="pill gold">Sample account</span>
        <span className="pill up mono">+4.2%</span>
      </div>
      <div>
        <small className="muted">Equity · 2-Step ₹1L (illustration)</small>
        <div className="big mono">₹1,04,200</div>
      </div>
      <canvas className="ch" ref={ref} />
      <div className="mini">
        <div><small>Target</small><b>8%</b></div>
        <div><small>Max loss</small><b>8%</b></div>
        <div><small>Split</small><b className="up">80 / 20</b></div>
      </div>
    </div>
  );
}
