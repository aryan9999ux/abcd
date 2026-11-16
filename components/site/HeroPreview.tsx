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

  const NAMES = ["NIFTY 50", "BANK NIFTY", "SENSEX", "FINNIFTY", "RELIANCE", "HDFC BANK", "TCS", "INFOSYS"];
  return (
    <div className="ht" aria-label="Illustration of the trading terminal">
      <div className="ht-frame" onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`); e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`); }}>
        <div className="ht-bar">
          <div className="dots"><i /><i /><i /></div>
          <div className="idx">{["NIFTY 50", "BANK NIFTY", "SENSEX"].map((n) => <span key={n}>{n}<em /></span>)}</div>
          <span className="live"><i />Live</span>
        </div>
        <div className="ht-body">
          <div className="ht-wl p1">
            {NAMES.map((n, i) => (
              <div key={n} className={i === 0 ? "on" : ""}>
                <b>{n}</b>
                <svg viewBox="0 0 40 18" width="36" height="14" aria-hidden="true"><path d={SPARK[i % SPARK.length]} pathLength="1" style={{ animationDelay: `${0.9 + i * 0.1}s` }} className={i % 3 === 1 ? "dn" : ""} /></svg>
              </div>
            ))}
          </div>
          <div className="ht-main p2">
            <div className="tools"><b>NIFTY FUT</b><span className="chips"><u className="on">1m</u><u>5m</u><u>15m</u><u>1D</u></span><span className="tabs"><u className="on">Chart</u><u>Option chain</u></span></div>
            <canvas className="ch" ref={ref} />
          </div>
          <div className="ht-side p3">
            <div className="chain">
              <span className="cap">Option chain</span>
              {[62, 48, 36, 25, 17, 11, 7].map((w, i) => (
                <div key={i} className={i === 3 ? "atm" : ""}><i className="ce" style={{ width: `${w}%` }} /><em /><i className="pe" style={{ width: `${[7, 11, 17, 25, 36, 48, 62][i]}%` }} /></div>
              ))}
            </div>
            <div className="tkt">
              <div className="sl"><span>Risk guard</span><b>On</b></div>
              <div className="bs"><span className="b">Buy</span><span className="s">Sell</span></div>
            </div>
          </div>
        </div>
        <div className="ht-foot p4">
          {[["Daily loss", "34%", ""], ["Drawdown", "18%", ""], ["Profit target", "62%", "g"]].map(([l, w, c]) => (
            <div key={l}><span>{l}</span><i className={c}><b style={{ "--w": w } as React.CSSProperties} /></i></div>
          ))}
        </div>
      </div>
      <p className="ht-note">Terminal preview. Layout illustration.</p>
    </div>
  );
}
