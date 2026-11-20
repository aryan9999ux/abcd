"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Side } from "@/lib/types";
import { num, inr } from "./format";
import type { Candle } from "./types";
import "./chart.css";

export interface ChartPending { id: string; side: Side; price: number }
export interface ChartPosition { entry: number; side: Side; pnl: number; qty: number; stop: number | null; target: number | null }
type Level = "stop" | "target";

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
  /** Move (or clear, with null) the stop loss or target of the open position. */
  onLevels?: (which: Level, price: number | null) => Promise<boolean>;
}

type Tool = "cursor" | "trend" | "hline" | "ray" | "rect" | "fib" | "text";
interface Pt { t: number; p: number }
interface Drawing { id: string; type: Exclude<Tool, "cursor">; pts: Pt[]; color: string; text?: string }
type Drag =
  | { kind: "pan"; x0: number; y0: number; off0: number; mn0: number; mx0: number; moved: boolean }
  | { kind: "price"; y0: number; mn0: number; mx0: number }
  | { kind: "time"; x0: number; bw0: number; off0: number; i0: number }
  | { kind: "handle"; id: string; idx: number }
  | { kind: "body"; id: string; i0: number; p0: number; orig: Pt[] }
  | { kind: "create"; x0: number; y0: number }
  | { kind: "level"; which: Level; moved: boolean }
  | { kind: "pinch"; d0: number; bw0: number; i0: number };

const TFS: [number, string][] = [[1, "1m"], [5, "5m"], [15, "15m"], [30, "30m"], [60, "1h"], [1440, "D"]];
const COLORS = ["#8b5cf6", "#22c55e", "#ef4444", "#f59e0b", "#38bdf8", "#e5e7eb"];
const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AXIS_W = 64, AXIS_H = 22, MIN_BW = 1.5, MAX_BW = 48, DEFAULT_BW = 8, DEFAULT_OFF = 6;
const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "cursor", label: "Cursor", icon: "M5 3l14 7-6 2-2 6z" },
  { id: "trend", label: "Trend line", icon: "M4 19L20 5M4 19h.01M20 5h.01" },
  { id: "hline", label: "Horizontal line", icon: "M3 12h18M12 12h.01" },
  { id: "ray", label: "Ray", icon: "M4 17l16-9M4 17h.01" },
  { id: "rect", label: "Rectangle", icon: "M5 6h14v12H5z" },
  { id: "fib", label: "Fib retracement", icon: "M4 5h16M4 10h16M4 15h16M4 20h16" },
  { id: "text", label: "Text note", icon: "M6 6h12M12 6v13M9 19h6" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");
const ist = (t: number) => new Date(t + 330 * 60000);
const dayKey = (t: number) => ist(t).toISOString().slice(0, 10);
const dm = (t: number) => { const d = ist(t); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
const hm = (t: number) => { const d = ist(t); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`; };
const snap = (v: number) => Math.round(v / 0.05) * 0.05;
const niceStep = (raw: number) => { const e = 10 ** Math.floor(Math.log10(raw)), f = raw / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; };
const fmtP = (v: number, step = 0.05) => num(v, step >= 1 ? 0 : 2);

function sma(cs: Candle[], n: number): (number | null)[] {
  const out: (number | null)[] = []; let s = 0;
  for (let i = 0; i < cs.length; i++) { s += cs[i].c; if (i >= n) s -= cs[i - n].c; out.push(i >= n - 1 ? s / n : null); }
  return out;
}
function ema(cs: Candle[], n: number): (number | null)[] {
  const k = 2 / (n + 1); const out: (number | null)[] = []; let e: number | null = null;
  for (let i = 0; i < cs.length; i++) { e = e == null ? cs[i].c : cs[i].c * k + e * (1 - k); out.push(i >= n - 1 ? e : null); }
  return out;
}
function bands(cs: Candle[], n: number, k = 2) {
  const up: (number | null)[] = [], lo: (number | null)[] = []; let s = 0, s2 = 0;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i].c; s += c; s2 += c * c;
    if (i >= n) { const o = cs[i - n].c; s -= o; s2 -= o * o; }
    if (i >= n - 1) { const m = s / n, sd = Math.sqrt(Math.max(0, s2 / n - m * m)); up.push(m + k * sd); lo.push(m - k * sd); } else { up.push(null); lo.push(null); }
  }
  return { up, lo };
}

/** Segment distance in pixels. */
function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number, ray = false): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = ray ? Math.max(0, t) : Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Candlestick chart with TradingView-style behaviour: drag to pan, wheel or pinch to zoom time, wheel or drag on the
 * price strip to stretch prices (double-click it to auto-fit), drawing tools, indicators, and click-to-trade.
 */
export default function ChartPanel(p: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);
  const props = useRef(p);
  props.current = p;
  const view = useRef({ bw: DEFAULT_BW, off: DEFAULT_OFF, manual: false, mn: 0, mx: 1 });
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const dr = useRef<Drawing[]>([]);
  const draft = useRef<Drawing | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<Drag | null>(null);
  const raf = useRef(0);
  const textAt = useRef<{ x: number; y: number; pt: Pt } | null>(null);
  const prevN = useRef({ n: 0, first: 0 });
  const indCache = useRef<{ cs: Candle[] | null; sma: (number | null)[]; ema: (number | null)[]; bu: (number | null)[]; bl: (number | null)[] }>({ cs: null, sma: [], ema: [], bu: [], bl: [] });

  const [tool, setTool] = useState<Tool>("cursor");
  const [color, setColor] = useState(COLORS[0]);
  const [ctype, setCtype] = useState<"candles" | "line">("candles");
  const [inds, setInds] = useState({ sma: false, ema: false, bb: false });
  const [indOpen, setIndOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [pop, setPop] = useState<{ x: number; y: number; price: number } | null>(null);
  const levelDrag = useRef<{ which: Level; price: number } | null>(null);
  const [lvlPop, setLvlPop] = useState<{ which: Level; price: string; x: number; y: number; edit: boolean } | null>(null);
  const [textEdit, setTextEdit] = useState<{ x: number; y: number; pt: Pt } | null>(null);
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const ui = useRef({ tool, color, ctype, inds, sel });
  ui.current = { tool, color, ctype, inds, sel };
  const storeKey = `edge-chart|${p.title}`;

  /* ---------- geometry ---------- */

  const geom = useCallback(() => {
    const c = cvs.current;
    if (!c) return null;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return null;
    const { candles: cs, tf } = props.current;
    const n = cs.length, v = view.current;
    const R = w - AXIS_W, B = h - AXIS_H, T = 8, bw = v.bw, off = v.off;
    const period = (tf >= 1440 ? 1440 : tf) * 60000;
    const ix = (x: number) => n - 1 + off + 0.5 - (R - x) / bw;
    const xi = (i: number) => R - (off + n - 1 - i + 0.5) * bw;
    const iL = ix(0), iR = ix(R);
    let mn = 0, mx = 1;
    if (n) {
      const lo = Math.max(0, Math.floor(iL)), hi = Math.min(n - 1, Math.ceil(iR));
      if (hi >= lo) { mn = Infinity; mx = -Infinity; for (let i = lo; i <= hi; i++) { if (cs[i].l < mn) mn = cs[i].l; if (cs[i].h > mx) mx = cs[i].h; } }
      if (!Number.isFinite(mn)) { mn = cs[n - 1].l; mx = cs[n - 1].h; }
      const pd = (mx - mn) * 0.1 || mx * 0.001 || 1; mn -= pd; mx += pd;
    }
    if (v.manual) { mn = v.mn; mx = v.mx; }
    const sy = (val: number) => B - ((B - T) * (val - mn)) / (mx - mn);
    const vy = (y: number) => mn + ((mx - mn) * (B - y)) / (B - T);
    const iOf = (t: number) => {
      if (!n) return 0;
      if (t <= cs[0].t) return (t - cs[0].t) / period;
      if (t >= cs[n - 1].t) return n - 1 + (t - cs[n - 1].t) / period;
      let a = 0, b = n - 1;
      while (b - a > 1) { const m = (a + b) >> 1; if (cs[m].t <= t) a = m; else b = m; }
      return a + (t - cs[a].t) / (cs[a + 1].t - cs[a].t);
    };
    const tOf = (i: number) => {
      if (!n) return 0;
      if (i <= 0) return cs[0].t + i * period;
      if (i >= n - 1) return cs[n - 1].t + (i - (n - 1)) * period;
      const k = Math.floor(i); return cs[k].t + (i - k) * (cs[k + 1].t - cs[k].t);
    };
    return { c, w, h, R, B, T, n, cs, bw, off, ix, xi, iL, iR, mn, mx, sy, vy, iOf, tOf, period };
  }, []);
  type Geo = NonNullable<ReturnType<typeof geom>>;

  const px = (g: Geo, pt: Pt) => ({ x: g.xi(g.iOf(pt.t)), y: g.sy(pt.p) });

  /** Which part of a drawing is under (x, y): an end point, the body, or nothing. */
  const hit = useCallback((g: Geo, d: Drawing, x: number, y: number): { part: "h"; idx: number } | { part: "b" } | null => {
    const P = d.pts.map((pt) => px(g, pt));
    if (d.type !== "hline") for (let i = 0; i < P.length; i++) if (Math.hypot(x - P[i].x, y - P[i].y) <= 9) return { part: "h", idx: i };
    if (d.type === "hline") return Math.abs(y - P[0].y) <= 6 ? { part: "b" } : null;
    if (d.type === "text") return x >= P[0].x - 4 && x <= P[0].x + 8 + (d.text?.length ?? 4) * 7 && Math.abs(y - P[0].y) <= 12 ? { part: "b" } : null;
    if (P.length < 2) return null;
    if (d.type === "trend" || d.type === "ray") return distSeg(x, y, P[0].x, P[0].y, P[1].x, P[1].y, d.type === "ray") <= 6 ? { part: "b" } : null;
    const x0 = Math.min(P[0].x, P[1].x), x1 = Math.max(P[0].x, P[1].x), y0 = Math.min(P[0].y, P[1].y), y1 = Math.max(P[0].y, P[1].y);
    if (d.type === "rect") return x >= x0 - 4 && x <= x1 + 4 && y >= y0 - 4 && y <= y1 + 4 ? { part: "b" } : null;
    return x >= x0 - 4 && x <= x1 + 4 && y >= y0 - 4 && y <= y1 + 4 ? { part: "b" } : null; // fib
  }, []);

  /* ---------- drawing ---------- */

  const draw = useCallback(() => {
    const g = geom();
    const c = cvs.current;
    if (!g || !c) return;
    const { w, h, R, B, T, n, cs, bw, xi, sy, vy, ix, tOf } = g;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext("2d");
    if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    const { last, position, pending } = props.current;
    const u = ui.current;

    const st = getComputedStyle(c);
    const tok = (k: string) => st.getPropertyValue(k).trim();
    const up = tok("--up") || "#22c55e", dn = tok("--down") || "#ef4444", mut = tok("--muted") || "#888", line = tok("--line") || "rgba(255,255,255,.08)";
    const acc = tok("--accent") || "#8b5cf6", accFg = tok("--accent-fg") || "#fff", fg = tok("--fg") || "#eee";
    const mono = tok("--f-mono") || "ui-monospace, monospace";
    x.font = `11px ${mono}`; x.textBaseline = "middle";

    if (!n) { x.fillStyle = mut; return; }

    // price grid and axis
    const step = niceStep((g.mx - g.mn) / Math.max(3, (B - T) / 56));
    x.save(); x.beginPath(); x.rect(0, 0, R, B); x.clip();
    for (let v = Math.ceil(g.mn / step) * step; v < g.mx; v += step) {
      const y = sy(v); x.strokeStyle = line; x.lineWidth = 1; x.beginPath(); x.moveTo(0, y); x.lineTo(R, y); x.stroke();
    }
    // vertical day separators on intraday charts
    if (props.current.tf < 1440) {
      const lo = Math.max(1, Math.floor(g.iL)), hi = Math.min(n - 1, Math.ceil(g.iR));
      for (let i = lo; i <= hi; i++) if (dayKey(cs[i].t) !== dayKey(cs[i - 1].t)) { const X = xi(i) - bw / 2; x.strokeStyle = line; x.beginPath(); x.moveTo(X, T); x.lineTo(X, B); x.stroke(); }
    }
    const lo = Math.max(0, Math.floor(g.iL) - 1), hi = Math.min(n - 1, Math.ceil(g.iR) + 1);

    if (u.ctype === "candles") {
      for (let i = lo; i <= hi; i++) {
        const k = cs[i], cx = xi(i), col = k.c >= k.o ? up : dn;
        x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx, sy(k.h)); x.lineTo(cx, sy(k.l)); x.stroke();
        const y1 = sy(Math.max(k.o, k.c)), y2 = sy(Math.min(k.o, k.c));
        const wd = Math.max(1, bw * 0.7);
        x.fillRect(cx - wd / 2, y1, wd, Math.max(1, y2 - y1));
      }
    } else {
      x.beginPath();
      for (let i = lo; i <= hi; i++) { const X = xi(i), Y = sy(cs[i].c); if (i === lo) x.moveTo(X, Y); else x.lineTo(X, Y); }
      x.strokeStyle = acc; x.lineWidth = 1.8; x.stroke();
      x.lineTo(xi(hi), B); x.lineTo(xi(lo), B); x.closePath();
      const gr = x.createLinearGradient(0, T, 0, B); gr.addColorStop(0, acc + "55"); gr.addColorStop(1, acc + "00"); x.fillStyle = gr; x.fill();
    }

    // indicators
    if (u.inds.sma || u.inds.ema || u.inds.bb) {
      const ic = indCache.current;
      if (ic.cs !== cs) { ic.cs = cs; ic.sma = sma(cs, 20); ic.ema = ema(cs, 50); const b = bands(cs, 20); ic.bu = b.up; ic.bl = b.lo; }
      const path = (arr: (number | null)[], col: string, wdt = 1.4, dash = false) => {
        x.beginPath(); let started = false;
        for (let i = lo; i <= hi; i++) { const val = arr[i]; if (val == null) continue; const X = xi(i), Y = sy(val); if (!started) { x.moveTo(X, Y); started = true; } else x.lineTo(X, Y); }
        x.strokeStyle = col; x.lineWidth = wdt; x.setLineDash(dash ? [4, 3] : []); x.stroke(); x.setLineDash([]);
      };
      if (u.inds.bb) { path(ic.bu, "#38bdf8", 1, true); path(ic.bl, "#38bdf8", 1, true); }
      if (u.inds.sma) path(ic.sma, "#f59e0b");
      if (u.inds.ema) path(ic.ema, "#e879f9");
    }

    // drawings
    const all = draft.current ? [...dr.current, draft.current] : dr.current;
    for (const d of all) {
      const P = d.pts.map((pt) => px(g, pt));
      const isSel = d.id === u.sel;
      x.strokeStyle = d.color; x.fillStyle = d.color; x.lineWidth = isSel ? 2.2 : 1.6; x.setLineDash([]);
      if (d.type === "hline") {
        x.beginPath(); x.moveTo(0, P[0].y); x.lineTo(R, P[0].y); x.stroke();
        x.fillStyle = d.color; x.fillRect(R + 1, P[0].y - 9, AXIS_W - 2, 18); x.fillStyle = "#0b0716"; x.fillText(fmtP(d.pts[0].p, step), R + 5, P[0].y);
      } else if (d.type === "text") {
        x.font = `600 12px ${st.getPropertyValue("--f-body") || "sans-serif"}`; x.fillStyle = d.color; x.fillText(d.text ?? "", P[0].x + 6, P[0].y); x.font = `11px ${mono}`;
        x.beginPath(); x.arc(P[0].x, P[0].y, 3, 0, 6.3); x.fill();
      } else if (P.length > 1) {
        if (d.type === "trend" || d.type === "ray") {
          let ex = P[1].x, ey = P[1].y;
          if (d.type === "ray") { const dx = P[1].x - P[0].x, dy = P[1].y - P[0].y; if (Math.abs(dx) > 0.01) { const k = (dx > 0 ? R + 200 : -200) - P[0].x; ex = P[0].x + k; ey = P[0].y + (dy / dx) * k; } }
          x.beginPath(); x.moveTo(P[0].x, P[0].y); x.lineTo(ex, ey); x.stroke();
        } else if (d.type === "rect") {
          x.globalAlpha = 0.14; x.fillRect(Math.min(P[0].x, P[1].x), Math.min(P[0].y, P[1].y), Math.abs(P[1].x - P[0].x), Math.abs(P[1].y - P[0].y)); x.globalAlpha = 1;
          x.strokeRect(Math.min(P[0].x, P[1].x), Math.min(P[0].y, P[1].y), Math.abs(P[1].x - P[0].x), Math.abs(P[1].y - P[0].y));
        } else if (d.type === "fib") {
          const xa = Math.min(P[0].x, P[1].x), xb = Math.max(P[0].x, P[1].x), p0 = d.pts[0].p, p1 = d.pts[1].p;
          FIB.forEach((lv, k) => {
            const price = p1 - (p1 - p0) * lv, Y = sy(price);
            x.globalAlpha = 0.07; if (k) { const prev = sy(p1 - (p1 - p0) * FIB[k - 1]); x.fillRect(xa, Math.min(Y, prev), xb - xa, Math.abs(Y - prev)); }
            x.globalAlpha = 1; x.lineWidth = 1; x.beginPath(); x.moveTo(xa, Y); x.lineTo(xb, Y); x.stroke();
            x.fillText(`${lv} (${fmtP(price, step)})`, xa + 4, Y - 7);
          });
          x.lineWidth = 1; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(P[0].x, P[0].y); x.lineTo(P[1].x, P[1].y); x.stroke(); x.setLineDash([]);
        }
      }
      if (isSel || d === draft.current) { x.fillStyle = "#fff"; x.strokeStyle = d.color; x.lineWidth = 2; for (const q of d.type === "hline" ? [] : P) { x.beginPath(); x.arc(q.x, q.y, 4.5, 0, 6.3); x.fill(); x.stroke(); } }
    }

    // position and pending orders
    const tag = (v: number, text: string, color: string, textColor: string, dash: boolean) => {
      const y = sy(v); if (y < T - 20 || y > B + 20) return;
      x.strokeStyle = color; x.lineWidth = 1.2; x.setLineDash(dash ? [6, 4] : []);
      x.beginPath(); x.moveTo(0, y); x.lineTo(R, y); x.stroke(); x.setLineDash([]);
      const tw = x.measureText(text).width + 14;
      x.fillStyle = color; x.fillRect(8, y - 9, tw, 18); x.fillStyle = textColor; x.fillText(text, 15, y);
    };
    if (position) tag(position.entry, `${position.side === "Buy" ? "B" : "S"} ${num(position.entry)}  ${inr(position.pnl)}`, position.pnl >= 0 ? up : dn, "#10131a", false);
    pending.forEach((o) => tag(o.price, `Order ${o.side[0]} ${num(o.price)}`, acc, accFg, true));
    if (position) {
      const lv = levelDrag.current, dir = position.side === "Buy" ? 1 : -1;
      for (const k of ["stop", "target"] as Level[]) {
        const val = lv && lv.which === k ? lv.price : k === "stop" ? position.stop : position.target;
        if (val == null || !(val > 0)) continue;
        const pnl = (val - position.entry) * position.qty * dir;
        tag(val, `${k === "stop" ? "SL" : "Target"} ${num(val)}  ${pnl >= 0 ? "+" : ""}${inr(pnl)}`, k === "stop" ? dn : up, "#10131a", true);
      }
    }
    x.restore();

    // last price line and tag
    const lastC = cs[n - 1], lp = last ?? lastC.c, ly = sy(lp), lc = lp >= lastC.o ? up : dn;
    if (ly > T && ly < B) {
      x.setLineDash([2, 3]); x.strokeStyle = lc; x.lineWidth = 1; x.beginPath(); x.moveTo(0, ly); x.lineTo(R, ly); x.stroke(); x.setLineDash([]);
      x.fillStyle = lc; x.fillRect(R + 1, ly - 9, AXIS_W - 2, 18); x.fillStyle = "#04130c"; x.fillText(fmtP(lp, step), R + 5, ly);
    }

    // price axis labels
    x.fillStyle = mut;
    for (let v = Math.ceil(g.mn / step) * step; v < g.mx; v += step) { const y = sy(v); if (y > T + 6 && y < B - 6 && Math.abs(y - ly) > 11) x.fillText(fmtP(v, step), R + 6, y); }

    // time axis
    x.fillStyle = mut; x.textAlign = "center";
    const pxPerMin = bw / (props.current.tf >= 1440 ? 1440 : props.current.tf);
    const stepMin = [5, 10, 15, 30, 60, 120, 240].find((m) => m * pxPerMin >= 78);
    const dayXs: number[] = [];
    // dates first, so a new trading day is always named
    for (let i = Math.max(0, Math.floor(g.iL)); i <= Math.min(n - 1, Math.ceil(g.iR)); i++) {
      const t = cs[i].t, X = xi(i);
      const newDay = i === 0 || dayKey(t) !== dayKey(cs[i - 1].t);
      if (!(props.current.tf >= 1440 ? true : newDay) || X < 24 || X > R - 24) continue;
      if (dayXs.length && X - dayXs[dayXs.length - 1] < 64) continue;
      dayXs.push(X);
      x.fillStyle = fg; x.fillText(dm(t), X, B + AXIS_H / 2 + 1);
      x.strokeStyle = line; x.beginPath(); x.moveTo(X, B); x.lineTo(X, B + 4); x.stroke();
    }
    if (props.current.tf < 1440) {
      let lastX = -999;
      for (let i = Math.max(0, Math.floor(g.iL)); i <= Math.min(n - 1, Math.ceil(g.iR)); i++) {
        const X = xi(i);
        if (X < 24 || X > R - 24 || X - lastX < 64 || dayXs.some((d) => Math.abs(d - X) < 56)) continue;
        const d = ist(cs[i].t);
        if (stepMin ? (d.getUTCHours() * 60 + d.getUTCMinutes()) % stepMin !== 0 : true) continue;
        lastX = X; x.fillStyle = mut; x.fillText(hm(cs[i].t), X, B + AXIS_H / 2 + 1);
        x.strokeStyle = line; x.beginPath(); x.moveTo(X, B); x.lineTo(X, B + 4); x.stroke();
      }
    }
    x.textAlign = "left";

    // legend of the candle under the cursor (or the last one)
    const m = mouse.current;
    const li = m && m.x < R ? Math.min(n - 1, Math.max(0, Math.round(ix(m.x)))) : n - 1;
    const k = cs[li];
    if (k) {
      const col = k.c >= k.o ? up : dn;
      const head = w < 480 ? "" : `${dm(k.t)} ${props.current.tf < 1440 ? hm(k.t) : ""}`;
      x.fillStyle = mut; x.fillText(head, 10, T + 8);
      const parts: [string, number][] = [["O", k.o], ["H", k.h], ["L", k.l], ["C", k.c]];
      let X = 10 + (head ? x.measureText(head).width + 12 : 0);
      for (const [lb, v] of parts) { x.fillStyle = mut; x.fillText(lb, X, T + 8); X += 12; x.fillStyle = col; const s = fmtP(v, step); x.fillText(s, X, T + 8); X += x.measureText(s).width + 10; }
    }

    // crosshair
    if (m && m.x < R && m.y < B && !drag.current) {
      x.strokeStyle = mut; x.lineWidth = 1; x.setLineDash([3, 3]);
      x.beginPath(); x.moveTo(0, m.y); x.lineTo(R, m.y); x.moveTo(m.x, T); x.lineTo(m.x, B); x.stroke(); x.setLineDash([]);
      const v = vy(m.y);
      x.fillStyle = acc; x.fillRect(R + 1, m.y - 9, AXIS_W - 2, 18); x.fillStyle = accFg; x.fillText(fmtP(v, step), R + 5, m.y);
      const tt = tOf(ix(m.x)), label = props.current.tf >= 1440 ? dm(tt) : `${dm(tt)} ${hm(tt)}`, tw = x.measureText(label).width + 12;
      x.fillStyle = acc; x.fillRect(Math.min(Math.max(0, m.x - tw / 2), R - tw), B + 2, tw, 18);
      x.fillStyle = accFg; x.textAlign = "center"; x.fillText(label, Math.min(Math.max(tw / 2, m.x), R - tw / 2), B + 11); x.textAlign = "left";
    }
  }, [geom]);

  const redraw = useCallback(() => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(draw); }, [draw]);

  useEffect(() => { redraw(); });

  /* ---------- persistence of drawings ---------- */

  const commit = useCallback((next: Drawing[]) => {
    dr.current = next; setCount(next.length);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* storage blocked */ }
    redraw();
  }, [storeKey, redraw]);

  useEffect(() => {
    let next: Drawing[] = [];
    try { const raw = localStorage.getItem(storeKey); if (raw) next = JSON.parse(raw) as Drawing[]; } catch { /* ignore */ }
    dr.current = Array.isArray(next) ? next : []; setCount(dr.current.length); setSel(null); setPop(null); setTextEdit(null); draft.current = null;
    view.current = { bw: DEFAULT_BW, off: DEFAULT_OFF, manual: false, mn: 0, mx: 1 };
    prevN.current = { n: 0, first: 0 };
    redraw();
  }, [storeKey, redraw]);

  useEffect(() => { view.current = { ...view.current, off: DEFAULT_OFF, manual: false }; redraw(); }, [p.tf, redraw]);
  useEffect(() => { draft.current = null; if (tool !== "cursor") setPop(null); redraw(); }, [tool, redraw]);

  // Keep the picture steady when new bars arrive while the trader is looking at older ones.
  const first = p.candles[0]?.t ?? 0;
  useEffect(() => {
    const pv = prevN.current, n = p.candles.length;
    if (pv.n && pv.first === first && n > pv.n && view.current.off < -0.5) view.current.off -= n - pv.n;
    prevN.current = { n, first };
  }, [p.candles.length, first]);

  /* ---------- events ---------- */

  useEffect(() => {
    const c = cvs.current;
    if (!c) return;
    const rel = (e: { clientX: number; clientY: number }) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const zone = (g: Geo, x: number, y: number) => (x >= g.R ? "price" : y >= g.B ? "time" : "plot");
    const toManual = (g: Geo) => { const v = view.current; if (!v.manual) { v.manual = true; v.mn = g.mn; v.mx = g.mx; } };
    const clampOff = (g: Geo) => { const v = view.current; v.off = Math.max(-(g.n - 3), Math.min(v.off, g.R / v.bw - 2)); };
    const zoomTime = (g: Geo, factor: number, anchorX: number) => {
      const v = view.current, i0 = g.ix(anchorX);
      v.bw = Math.max(MIN_BW, Math.min(MAX_BW, v.bw * factor));
      v.off = i0 - (g.n - 1) - 0.5 + (g.R - anchorX) / v.bw;
      clampOff(g);
    };
    const zoomPrice = (g: Geo, factor: number, anchorPrice: number) => {
      toManual(g); const v = view.current;
      v.mn = anchorPrice - (anchorPrice - v.mn) * factor; v.mx = anchorPrice + (v.mx - anchorPrice) * factor;
    };
    const mk = (type: Drawing["type"], pt: Pt, extra?: Partial<Drawing>): Drawing => ({ id: Math.random().toString(36).slice(2, 9), type, pts: type === "hline" || type === "text" ? [pt] : [pt, { ...pt }], color: ui.current.color, ...extra });
    const ptAt = (g: Geo, x: number, y: number): Pt => ({ t: g.tOf(g.ix(x)), p: snap(g.vy(y)) });

    function down(e: PointerEvent) {
      const g = geom(); if (!g) return;
      const { x, y } = rel(e);
      c!.setPointerCapture(e.pointerId);
      ptrs.current.set(e.pointerId, { x, y });
      c!.focus({ preventScroll: true });
      if (ptrs.current.size === 2) {
        const [a, b] = [...ptrs.current.values()];
        drag.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, bw0: view.current.bw, i0: g.ix((a.x + b.x) / 2) };
        return;
      }
      const z = zone(g, x, y), v = view.current;
      if (z === "price") { drag.current = { kind: "price", y0: y, mn0: g.mn, mx0: g.mx }; return; }
      if (z === "time") { drag.current = { kind: "time", x0: x, bw0: v.bw, off0: v.off, i0: g.ix(x) }; return; }
      const u = ui.current;
      if (u.tool !== "cursor") {
        const pt = ptAt(g, x, y);
        if (u.tool === "hline") { const d = mk("hline", pt); commit([...dr.current, d]); setSel(d.id); setTool("cursor"); return; }
        if (u.tool === "text") { textAt.current = { x, y, pt }; return; } // the box opens on release, after the browser has finished moving focus
        if (draft.current) { // second click of a click-click drawing
          draft.current.pts[1] = pt; const d = draft.current; draft.current = null; commit([...dr.current, d]); setSel(d.id); setTool("cursor"); return;
        }
        draft.current = mk(u.tool, pt); drag.current = { kind: "create", x0: x, y0: y }; redraw(); return;
      }
      const pos = props.current.position;
      if (pos && props.current.onLevels) {
        for (const k of ["stop", "target"] as Level[]) {
          const val = k === "stop" ? pos.stop : pos.target;
          if (val != null && Math.abs(g.sy(val) - y) <= 7) {
            levelDrag.current = { which: k, price: val }; drag.current = { kind: "level", which: k, moved: false }; setPop(null); setLvlPop(null); redraw(); return;
          }
        }
      }
      // cursor: pick a drawing first, else pan
      for (let i = dr.current.length - 1; i >= 0; i--) {
        const d = dr.current[i], h = hit(g, d, x, y);
        if (!h) continue;
        setSel(d.id); setPop(null);
        drag.current = h.part === "h" ? { kind: "handle", id: d.id, idx: h.idx } : { kind: "body", id: d.id, i0: g.ix(x), p0: g.vy(y), orig: d.pts.map((q) => ({ ...q })) };
        redraw(); return;
      }
      setSel(null);
      drag.current = { kind: "pan", x0: x, y0: y, off0: v.off, mn0: g.mn, mx0: g.mx, moved: false };
    }

    function move(e: PointerEvent) {
      const g = geom(); if (!g) return;
      const { x, y } = rel(e);
      if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x, y });
      const d = drag.current, v = view.current;
      if (!d) {
        mouse.current = { x, y };
        const z = zone(g, x, y);
        let cur = z === "price" ? "ns-resize" : z === "time" ? "ew-resize" : ui.current.tool === "cursor" ? "crosshair" : "copy";
        const pos0 = props.current.position;
        if (z === "plot" && ui.current.tool === "cursor" && pos0 && props.current.onLevels && ([pos0.stop, pos0.target] as (number | null)[]).some((val) => val != null && Math.abs(g.sy(val) - y) <= 7)) cur = "ns-resize";
        else if (z === "plot" && ui.current.tool === "cursor") for (let i = dr.current.length - 1; i >= 0; i--) { const h = hit(g, dr.current[i], x, y); if (h) { cur = h.part === "h" ? "pointer" : "move"; break; } }
        c!.style.cursor = props.current.disabled && cur === "crosshair" ? "crosshair" : cur;
        if (draft.current && ui.current.tool !== "cursor") draft.current.pts[1] = ptAt(g, x, y);
        redraw(); return;
      }
      mouse.current = { x, y };
      if (d.kind === "pinch") {
        const [a, b] = [...ptrs.current.values()]; if (!a || !b) return;
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1, mid = (a.x + b.x) / 2;
        v.bw = Math.max(MIN_BW, Math.min(MAX_BW, d.bw0 * (dist / d.d0)));
        v.off = d.i0 - (g.n - 1) - 0.5 + (g.R - mid) / v.bw; clampOff(g); redraw(); return;
      }
      if (d.kind === "pan") {
        const dx = x - d.x0, dy = y - d.y0;
        if (!d.moved && Math.hypot(dx, dy) < 4) return;
        d.moved = true; c!.style.cursor = "grabbing";
        v.off = d.off0 - dx / v.bw; clampOff(g);
        if (v.manual || Math.abs(dy) > 6) { toManual(g); const range = d.mx0 - d.mn0, per = range / (g.B - g.T); v.mn = d.mn0 + dy * per; v.mx = d.mx0 + dy * per; }
        redraw(); return;
      }
      if (d.kind === "price") {
        toManual(g); const f = Math.exp(-(y - d.y0) * 0.006), mid = (d.mn0 + d.mx0) / 2, half = ((d.mx0 - d.mn0) / 2) * (1 / f);
        v.mn = mid - half; v.mx = mid + half; redraw(); return;
      }
      if (d.kind === "time") { v.bw = Math.max(MIN_BW, Math.min(MAX_BW, d.bw0 * Math.exp((x - d.x0) * 0.006))); v.off = d.i0 - (g.n - 1) - 0.5 + (g.R - d.x0) / v.bw; clampOff(g); redraw(); return; }
      if (d.kind === "level") { if (levelDrag.current) { levelDrag.current.price = Number(snap(g.vy(Math.min(Math.max(y, g.T), g.B))).toFixed(2)); d.moved = true; } redraw(); return; }
      if (d.kind === "create" && draft.current) { draft.current.pts[1] = ptAt(g, x, y); redraw(); return; }
      if (d.kind === "handle") { const dd = dr.current.find((q) => q.id === d.id); if (dd) { dd.pts[d.idx] = ptAt(g, x, y); redraw(); } return; }
      if (d.kind === "body") {
        const dd = dr.current.find((q) => q.id === d.id); if (!dd) return;
        const di = g.ix(x) - d.i0, dp = g.vy(y) - d.p0;
        dd.pts = d.orig.map((q) => ({ t: g.tOf(g.iOf(q.t) + di), p: snap(q.p + dp) })); redraw();
      }
    }

    function up(e: PointerEvent) {
      const g = geom();
      const d = drag.current;
      ptrs.current.delete(e.pointerId);
      if (textAt.current) { setTextEdit(textAt.current); textAt.current = null; return; }
      if (ptrs.current.size === 1 && d?.kind === "pinch") { drag.current = null; return; }
      drag.current = null;
      if (!g || !d) return;
      const { x, y } = rel(e);
      if (d.kind === "create" && draft.current) {
        if (Math.hypot(x - d.x0, y - d.y0) > 8) { const dd = draft.current; draft.current = null; commit([...dr.current, dd]); setSel(dd.id); setTool("cursor"); }
        return; // a plain click keeps the draft: the next click finishes it
      }
      if (d.kind === "level") {
        const ld = levelDrag.current;
        if (d.moved && ld) setLvlPop({ which: ld.which, price: ld.price.toFixed(2), x: Math.min(Math.max(8, x - 120), g.w - 250), y: Math.min(Math.max(8, y - 150), g.h - 190), edit: false });
        else { levelDrag.current = null; redraw(); }
        return;
      }
      if (d.kind === "handle" || d.kind === "body") { commit([...dr.current]); return; }
      if (d.kind === "pan" && !d.moved && zone(g, x, y) === "plot" && ui.current.tool === "cursor" && !props.current.disabled) {
        const price = Number(snap(g.vy(y)).toFixed(2));
        setPop({ x: Math.min(Math.max(8, x + 10), g.w - 230), y: Math.min(Math.max(8, y - 40), g.h - 190), price });
      }
      c!.style.cursor = "crosshair";
    }

    function wheel(e: WheelEvent) {
      const g = geom(); if (!g) return;
      e.preventDefault();
      const { x, y } = rel(e), z = zone(g, x, y), f = Math.exp(e.deltaY * 0.0016);
      if (z === "price" || e.ctrlKey || e.metaKey) zoomPrice(g, f, g.vy(Math.min(Math.max(y, g.T), g.B)));
      else if (e.shiftKey) { view.current.off -= (e.deltaY + e.deltaX) / view.current.bw / 2; clampOff(g); }
      else zoomTime(g, 1 / f, Math.min(x, g.R));
      redraw();
    }

    function dbl(e: MouseEvent) {
      const g = geom(); if (!g) return;
      const { x, y } = rel(e), z = zone(g, x, y);
      const pos = props.current.position;
      if (z === "plot" && pos && props.current.onLevels) {
        for (const k of ["stop", "target"] as Level[]) {
          const val = k === "stop" ? pos.stop : pos.target;
          if (val != null && Math.abs(g.sy(val) - y) <= 7) {
            levelDrag.current = { which: k, price: val };
            setLvlPop({ which: k, price: val.toFixed(2), x: Math.min(Math.max(8, x - 120), g.w - 250), y: Math.min(Math.max(8, y - 150), g.h - 190), edit: true }); redraw(); return;
          }
        }
      }
      if (z === "price") view.current.manual = false;
      else if (z === "time") { view.current.bw = DEFAULT_BW; view.current.off = DEFAULT_OFF; }
      redraw();
    }

    function key(e: KeyboardEvent) {
      if (e.key === "Escape") { draft.current = null; setTool("cursor"); setSel(null); setTextEdit(null); redraw(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && ui.current.sel) { e.preventDefault(); commit(dr.current.filter((q) => q.id !== ui.current.sel)); setSel(null); }
    }
    const leave = () => { mouse.current = null; redraw(); };

    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up); c.addEventListener("pointerleave", leave); c.addEventListener("wheel", wheel, { passive: false });
    c.addEventListener("dblclick", dbl); c.addEventListener("keydown", key);
    const ro = new ResizeObserver(redraw); ro.observe(c);
    const mo = new MutationObserver(redraw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move); c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up); c.removeEventListener("pointerleave", leave); c.removeEventListener("wheel", wheel);
      c.removeEventListener("dblclick", dbl); c.removeEventListener("keydown", key); ro.disconnect(); mo.disconnect();
    };
  }, [geom, hit, commit, redraw]);

  useEffect(() => { setPop(null); }, [p.title]);

  async function submit(side: Side) {
    if (!pop || busy) return;
    const q = Math.floor(Number(qty));
    if (!(q > 0)) return;
    setBusy(true);
    const ok = await p.onOrder(side, pop.price, q);
    setBusy(false);
    if (ok) setPop(null);
  }

  async function confirmLevel() {
    if (!lvlPop || !p.onLevels || busy) return;
    const price = Number(lvlPop.price);
    if (!(price > 0)) return;
    setBusy(true);
    await p.onLevels(lvlPop.which, price);
    setBusy(false); levelDrag.current = null; setLvlPop(null); redraw();
  }
  async function removeLevel() {
    if (!lvlPop || !p.onLevels || busy) return;
    setBusy(true);
    await p.onLevels(lvlPop.which, null);
    setBusy(false); levelDrag.current = null; setLvlPop(null); redraw();
  }
  function cancelLevel() { levelDrag.current = null; setLvlPop(null); redraw(); }
  async function setLevelHere(which: Level) {
    if (!pop || !p.onLevels || busy) return;
    setBusy(true);
    const ok = await p.onLevels(which, pop.price);
    setBusy(false);
    if (ok) setPop(null);
  }

  function saveText(value: string) {
    const te = textEdit; setTextEdit(null);
    if (!te || !value.trim()) return;
    const d: Drawing = { id: Math.random().toString(36).slice(2, 9), type: "text", pts: [te.pt], color, text: value.trim().slice(0, 60) };
    commit([...dr.current, d]); setSel(d.id); setTool("cursor");
  }
  function pickColor(c: string) {
    setColor(c);
    if (sel) commit(dr.current.map((d) => (d.id === sel ? { ...d, color: c } : d)));
  }
  const resetView = () => { view.current = { bw: DEFAULT_BW, off: DEFAULT_OFF, manual: false, mn: 0, mx: 1 }; redraw(); };

  return (
    <div className="tr-cw ch" ref={wrap}>
      <div className="ch-top">
        <div className="tr-tfs" role="group" aria-label="Timeframe">
          {TFS.map(([m, l]) => <button key={m} aria-pressed={p.tf === m} onClick={() => p.onTf(m)}>{l}</button>)}
        </div>
        <div className="ch-sp" />
        <div className="tr-tfs" role="group" aria-label="Chart type">
          <button aria-pressed={ctype === "candles"} onClick={() => setCtype("candles")} title="Candles">Candles</button>
          <button aria-pressed={ctype === "line"} onClick={() => setCtype("line")} title="Line">Line</button>
        </div>
        <div className="ch-ind">
          <button className={"ch-btn" + (indOpen ? " on" : "")} onClick={() => setIndOpen(!indOpen)} aria-expanded={indOpen}>Indicators{inds.sma || inds.ema || inds.bb ? ` · ${[inds.sma, inds.ema, inds.bb].filter(Boolean).length}` : ""}</button>
          {indOpen && (
            <div className="ch-menu" role="menu">
              {([["sma", "SMA 20", "#f59e0b"], ["ema", "EMA 50", "#e879f9"], ["bb", "Bollinger 20", "#38bdf8"]] as const).map(([k, l, col]) => (
                <label key={k}><input type="checkbox" checked={inds[k]} onChange={(e) => setInds({ ...inds, [k]: e.target.checked })} /><i style={{ background: col }} />{l}</label>
              ))}
            </div>
          )}
        </div>
        <button className="ch-btn" onClick={resetView} title="Fit the chart to the latest bars" aria-label="Reset chart view">Reset</button>
      </div>
      <div className="ch-body">
        <div className="ch-tools" role="toolbar" aria-label="Drawing tools">
          {TOOLS.map((t) => (
            <button key={t.id} className={"ch-tool" + (tool === t.id ? " on" : "")} onClick={() => setTool(t.id)} aria-pressed={tool === t.id} title={t.label} aria-label={t.label}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
            </button>
          ))}
          <span className="ch-div" />
          {COLORS.map((c) => <button key={c} className={"ch-sw" + (color === c ? " on" : "")} style={{ background: c }} onClick={() => pickColor(c)} aria-label={`Colour ${c}`} />)}
          <span className="ch-div" />
          <button className="ch-tool" disabled={!sel} onClick={() => { if (sel) { commit(dr.current.filter((d) => d.id !== sel)); setSel(null); } }} title="Delete selected drawing" aria-label="Delete selected drawing">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
          </button>
          <button className="ch-tool" disabled={!count} onClick={() => { commit([]); setSel(null); }} title="Remove all drawings" aria-label="Remove all drawings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </button>
        </div>
        <div className="ch-plot">
          <canvas
            ref={cvs}
            tabIndex={0}
            role="img"
            aria-label={`${p.title} chart. Drag to move, scroll to zoom, click a price to place an order.`}
            style={{ touchAction: "none" }}
          />
          {!p.candles.length && <div className="tr-chart-empty">{p.note ?? "Waiting for prices…"}</div>}
          {textEdit && (
            <form className="ch-text" style={{ left: Math.min(textEdit.x, 240), top: textEdit.y }} onSubmit={(e) => { e.preventDefault(); saveText(String(new FormData(e.currentTarget).get("t") ?? "")); }}>
              <input name="t" autoFocus maxLength={60} placeholder="Type a note, press Enter" onKeyDown={(e) => { if (e.key === "Escape") setTextEdit(null); }} onBlur={(e) => { if (e.currentTarget.value.trim()) saveText(e.currentTarget.value); else setTextEdit(null); }} />
            </form>
          )}
          {lvlPop && p.position && (
            <div className="tr-pop tr-lvl" style={{ left: lvlPop.x, top: lvlPop.y }} role="dialog" aria-label={lvlPop.which === "stop" ? "Move stop loss" : "Move target"}>
              <div className="tr-ln"><b>{lvlPop.which === "stop" ? "Move stop loss" : "Move target"}</b><button className="tr-btn sm" onClick={cancelLevel} aria-label="Close">×</button></div>
              <label className="tr-f">Price<input type="number" step={0.05} value={lvlPop.price} autoFocus onChange={(e) => { setLvlPop({ ...lvlPop, price: e.target.value }); const v = Number(e.target.value); if (v > 0 && levelDrag.current) { levelDrag.current.price = v; redraw(); } }} /></label>
              <div className="tr-ln">
                <span className="tr-muted">{lvlPop.which === "stop" ? "If hit" : "If hit"}</span>
                {(() => { const v = (Number(lvlPop.price) - p.position.entry) * p.position.qty * (p.position.side === "Buy" ? 1 : -1); return <b className={"tr-mono " + (v >= 0 ? "tr-up" : "tr-down")}>{v >= 0 ? "+" : ""}{inr(v)}</b>; })()}
              </div>
              <div className="two">
                <button className="tr-btn primary" disabled={busy} onClick={confirmLevel}>{busy ? "Saving…" : "Confirm"}</button>
                <button className="tr-btn" disabled={busy} onClick={cancelLevel}>Cancel</button>
              </div>
              {lvlPop.edit && <button className="tr-btn sm" disabled={busy} onClick={removeLevel}>{lvlPop.which === "stop" ? "Remove stop loss" : "Remove target"}</button>}
            </div>
          )}
          {pop && (
            <div className="tr-pop" style={{ left: pop.x, top: pop.y }} role="dialog" aria-label="Chart order">
              <div className="tr-ln"><b>{p.title}</b><button className="tr-btn sm" onClick={() => setPop(null)} aria-label="Close">×</button></div>
              <div className="tr-ln"><span className="tr-muted">Price</span><b className="tr-mono">{num(pop.price)}</b></div>
              <label className="tr-f">{p.qtyLabel}<input type="number" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
              <div className="two">
                <button className="tr-btn buy" disabled={busy} onClick={() => submit("Buy")}>Buy</button>
                <button className="tr-btn sell" disabled={busy} onClick={() => submit("Sell")}>Sell</button>
              </div>
              {p.position && p.onLevels && (
                <div className="two">
                  <button className="tr-btn sm" disabled={busy} onClick={() => setLevelHere("stop")}>Set stop loss here</button>
                  <button className="tr-btn sm" disabled={busy} onClick={() => setLevelHere("target")}>Set target here</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="tr-hint">
        {p.disabled
          ? p.disabledText
          : tool !== "cursor"
            ? "Click on the chart to draw. Press Esc to stop."
            : p.position && p.onLevels
              ? "Drag the SL or Target line to move it, then confirm. Double-click a line to type an exact price. Click a price to trade."
              : "Drag to move, scroll to zoom. Drag or scroll on the price side to stretch prices; double-click it to fit. Click a price to trade."}
      </p>
    </div>
  );
}
