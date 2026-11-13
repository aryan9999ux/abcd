"use client";
import { useCallback, useEffect, useRef } from "react";

interface Props {
  points: number[];
  base: number;
  emptyText: string;
}

/** Equity curve with a dashed starting-balance line and a marked latest point. */
export default function EquityChart({ points, base, emptyText }: Props) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const data = useRef(points);
  const baseRef = useRef(base);
  data.current = points;
  baseRef.current = base;

  const draw = useCallback(() => {
    const c = cvs.current;
    if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = w * dpr; c.height = h * dpr;
    const x = c.getContext("2d");
    if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    const pts = data.current;
    if (pts.length < 2) return;
    const st = getComputedStyle(c);
    const tok = (n: string) => st.getPropertyValue(n).trim();
    const mut = tok("--muted"), line = tok("--line");
    const b = baseRef.current;
    const up = pts[pts.length - 1] >= b;
    const col = up ? tok("--up") : tok("--down");
    let mn = Math.min(...pts, b), mx = Math.max(...pts, b);
    const pad = (mx - mn) * 0.12 || 1;
    mn -= pad; mx += pad;
    const R = w - 58, T = 8, B = h - 8;
    const sx = (i: number) => (R * i) / (pts.length - 1);
    const sy = (v: number) => B - ((B - T) * (v - mn)) / (mx - mn);
    x.font = `11px ${tok("--f-mono") || "ui-monospace, monospace"}`;
    x.textBaseline = "middle";
    for (let k = 0; k <= 3; k++) {
      const v = mn + ((mx - mn) * k) / 3, y = sy(v);
      x.strokeStyle = line; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, y); x.lineTo(R, y); x.stroke();
      x.fillStyle = mut; x.fillText("₹" + Math.round(v / 1000) + "k", R + 6, y);
    }
    x.setLineDash([4, 4]); x.strokeStyle = mut;
    x.beginPath(); x.moveTo(0, sy(b)); x.lineTo(R, sy(b)); x.stroke(); x.setLineDash([]);
    const g = x.createLinearGradient(0, T, 0, B);
    g.addColorStop(0, col + "55"); g.addColorStop(1, col + "00");
    x.beginPath();
    pts.forEach((v, i) => (i ? x.lineTo(sx(i), sy(v)) : x.moveTo(sx(i), sy(v))));
    x.strokeStyle = col; x.lineWidth = 2; x.lineJoin = "round"; x.stroke();
    x.lineTo(sx(pts.length - 1), B); x.lineTo(0, B); x.closePath();
    x.fillStyle = g; x.fill();
    x.beginPath(); x.arc(sx(pts.length - 1), sy(pts[pts.length - 1]), 4, 0, Math.PI * 2);
    x.fillStyle = col; x.fill();
  }, []);

  useEffect(() => { draw(); });
  useEffect(() => {
    const c = cvs.current;
    if (!c) return;
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    const mo = new MutationObserver(draw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", draw);
    return () => { ro.disconnect(); mo.disconnect(); mq.removeEventListener("change", draw); };
  }, [draw]);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={cvs} role="img" aria-label="Equity curve" />
      {points.length < 2 && <div className="tr-chart-empty">{emptyText}</div>}
    </div>
  );
}
