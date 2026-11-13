"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Side } from "@/lib/types";
import { num, inr } from "./format";
import type { Candle } from "./types";

export interface ChartPending { id: string; side: Side; price: number }
export interface ChartPosition { entry: number; side: Side; pnl: number }

interface Props {
  title: string;
  candles: Candle[];
  last: number | null;
  position: ChartPosition | null;
  pending: ChartPending[];
  tf: number;
  onTf: (m: number) => void;
  qtyLabel: string;
  disabled: boolean;
  disabledText?: string;
  note?: string;
  onOrder: (side: Side, price: number, qty: number) => Promise<boolean>;
}

const TFS = [1, 5, 15];

/** Candlestick chart. Click a price level to open a small ticket and trade from the chart. */
export default function ChartPanel(p: Props) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const geo = useRef<{ mn: number; mx: number; T: number; B: number; R: number } | null>(null);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const props = useRef(p);
  props.current = p;
  const [pop, setPop] = useState<{ x: number; y: number; price: number } | null>(null);
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);

  const draw = useCallback(() => {
    const c = cvs.current;
    if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = w * dpr;
    c.height = h * dpr;
    const x = c.getContext("2d");
    if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    const { candles: cs, last, position, pending } = props.current;
    if (!cs.length) { geo.current = null; return; }

    const st = getComputedStyle(c);
    const tok = (n: string) => st.getPropertyValue(n).trim();
    const up = tok("--up"), dn = tok("--down"), mut = tok("--muted"), line = tok("--line"), acc = tok("--accent"), accFg = tok("--accent-fg");
    const mono = (tok("--f-mono") || "ui-monospace, monospace");

    let mn = Math.min(...cs.map((k) => k.l)), mx = Math.max(...cs.map((k) => k.h));
    for (const v of [position?.entry, ...pending.map((o) => o.price)]) if (v) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
    const pad = (mx - mn) * 0.08 || 1;
    mn -= pad; mx += pad;
    const R = w - 66, T = 6, B = h - 6, n = cs.length, bw = R / n;
    const sy = (v: number) => B - ((B - T) * (v - mn)) / (mx - mn);
    geo.current = { mn, mx, T, B, R };

    x.font = `11px ${mono}`;
    x.textBaseline = "middle";
    for (let k = 0; k <= 5; k++) {
      const v = mn + ((mx - mn) * k) / 5, y = sy(v);
      x.strokeStyle = line; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, y); x.lineTo(R, y); x.stroke();
      x.fillStyle = mut; x.fillText(num(v, v > 1000 ? 0 : 2), R + 6, y);
    }
    cs.forEach((k, i) => {
      const cx = i * bw + bw / 2, col = k.c >= k.o ? up : dn;
      x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 1;
      x.beginPath(); x.moveTo(cx, sy(k.h)); x.lineTo(cx, sy(k.l)); x.stroke();
      const y1 = sy(Math.max(k.o, k.c)), y2 = sy(Math.min(k.o, k.c));
      x.fillRect(cx - bw * 0.33, y1, bw * 0.66, Math.max(1, y2 - y1));
    });
    const lastC = cs[cs.length - 1];
    const lp = last ?? lastC.c, ly = sy(lp), lc = lp >= lastC.o ? up : dn;
    x.setLineDash([2, 3]); x.strokeStyle = lc;
    x.beginPath(); x.moveTo(0, ly); x.lineTo(R, ly); x.stroke(); x.setLineDash([]);
    x.fillStyle = lc; x.fillRect(R + 1, ly - 9, 64, 18);
    x.fillStyle = "#04130c"; x.fillText(num(lp, lp > 1000 ? 1 : 2), R + 5, ly);

    const tag = (v: number, text: string, color: string, textColor: string, dash: boolean) => {
      const y = sy(v);
      x.strokeStyle = color; x.lineWidth = 1.2; x.setLineDash(dash ? [6, 4] : []);
      x.beginPath(); x.moveTo(0, y); x.lineTo(R, y); x.stroke(); x.setLineDash([]);
      const tw = x.measureText(text).width + 14;
      x.fillStyle = color; x.fillRect(8, y - 9, tw, 18);
      x.fillStyle = textColor; x.fillText(text, 15, y);
    };
    if (position) tag(position.entry, `${position.side === "Buy" ? "B" : "S"} ${num(position.entry)}  ${inr(position.pnl)}`, position.pnl >= 0 ? up : dn, "#10131a", false);
    pending.forEach((o) => tag(o.price, `Order ${o.side[0]} ${num(o.price)}`, acc, accFg || "#1a1305", true));

    const m = mouse.current;
    if (m && m.x < R) {
      x.strokeStyle = mut; x.setLineDash([3, 3]);
      x.beginPath(); x.moveTo(0, m.y); x.lineTo(R, m.y); x.moveTo(m.x, T); x.lineTo(m.x, B); x.stroke(); x.setLineDash([]);
      const v = mn + ((mx - mn) * (B - m.y)) / (B - T);
      x.fillStyle = acc; x.fillRect(R + 1, m.y - 9, 64, 18);
      x.fillStyle = accFg || "#1a1305"; x.fillText(num(v, v > 1000 ? 1 : 2), R + 5, m.y);
    }
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

  useEffect(() => { setPop(null); }, [p.title]);

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const g = geo.current, c = cvs.current;
    if (!g || !c || p.disabled) return;
    const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (x > g.R) return;
    const raw = g.mn + ((g.mx - g.mn) * (g.B - y)) / (g.B - g.T);
    const price = Number((Math.round(raw / 0.05) * 0.05).toFixed(2));
    setPop({ x: Math.min(Math.max(8, x + 10), c.clientWidth - 230), y: Math.min(Math.max(8, y - 40), c.clientHeight - 190), price });
  }

  async function submit(side: Side) {
    if (!pop || busy) return;
    const q = Math.floor(Number(qty));
    if (!(q > 0)) return;
    setBusy(true);
    const ok = await p.onOrder(side, pop.price, q);
    setBusy(false);
    if (ok) setPop(null);
  }

  return (
    <div className="tr-cw">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <div className="tr-tfs" role="group" aria-label="Timeframe">
          {TFS.map((m) => (
            <button key={m} aria-pressed={p.tf === m} onClick={() => p.onTf(m)}>{m}m</button>
          ))}
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <canvas
          ref={cvs}
          role="img"
          aria-label={`${p.title} candlestick chart. Click a price to place an order.`}
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top }; draw(); }}
          onMouseLeave={() => { mouse.current = null; draw(); }}
          onClick={onClick}
          style={p.disabled ? { cursor: "not-allowed" } : undefined}
        />
        {!p.candles.length && <div className="tr-chart-empty">{p.note ?? "Waiting for prices…"}</div>}
        {pop && (
          <div className="tr-pop" style={{ left: pop.x, top: pop.y }} role="dialog" aria-label="Chart order">
            <div className="tr-ln"><b>{p.title}</b><button className="tr-btn sm" onClick={() => setPop(null)} aria-label="Close">×</button></div>
            <div className="tr-ln"><span className="tr-muted">Price</span><b className="tr-mono">{num(pop.price)}</b></div>
            <label className="tr-f">{p.qtyLabel}<input type="number" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
            <div className="two">
              <button className="tr-btn buy" disabled={busy} onClick={() => submit("Buy")}>Buy</button>
              <button className="tr-btn sell" disabled={busy} onClick={() => submit("Sell")}>Sell</button>
            </div>
          </div>
        )}
      </div>
      <p className="tr-hint">
        {p.disabled
          ? p.disabledText
          : "Click a price on the chart to place an order there. Dashed lines are pending orders; the solid line is your open position."}
      </p>
    </div>
  );
}
