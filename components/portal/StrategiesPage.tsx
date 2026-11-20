"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { inr, num } from "@/components/trading/format";
import { useQuotes } from "@/components/trading/useQuotes";
import { PageHead } from "./ui";

type Und = "NIFTY" | "BANKNIFTY" | "SENSEX";
interface Leg { id: number; side: 1 | -1; type: "CE" | "PE"; strike: number; lots: number; prem: number | null }

const U: Record<Und, { name: string; spot: number; step: number; lot: number }> = {
  NIFTY: { name: "Nifty 50", spot: 24200, step: 50, lot: 75 },
  BANKNIFTY: { name: "Bank Nifty", spot: 52500, step: 100, lot: 30 },
  SENSEX: { name: "Sensex", spot: 79500, step: 100, lot: 20 },
};
const RATE = 0.065;

/* Black-Scholes premium, used when you do not type your own. */
const cdf = (x: number) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp((-x * x) / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
function bs(type: "CE" | "PE", S: number, K: number, days: number, iv: number) {
  const T = Math.max(days, 0) / 365;
  if (T <= 0 || iv <= 0) return type === "CE" ? Math.max(S - K, 0) : Math.max(K - S, 0);
  const sd = iv * Math.sqrt(T), d1 = (Math.log(S / K) + (RATE + (iv * iv) / 2) * T) / sd, d2 = d1 - sd;
  return type === "CE" ? S * cdf(d1) - K * Math.exp(-RATE * T) * cdf(d2) : K * Math.exp(-RATE * T) * cdf(-d2) - S * cdf(-d1);
}
const r05 = (v: number) => Math.round(v * 20) / 20;

type Preset = { k: string; name: string; hint: string; build: (atm: number, step: number) => Omit<Leg, "id" | "prem">[] };
const PRESETS: Preset[] = [
  { k: "ls", name: "Long straddle", hint: "Profit from a big move either way", build: (a) => [{ side: 1, type: "CE", strike: a, lots: 1 }, { side: 1, type: "PE", strike: a, lots: 1 }] },
  { k: "ss", name: "Short straddle", hint: "Profit if the market stays near here", build: (a) => [{ side: -1, type: "CE", strike: a, lots: 1 }, { side: -1, type: "PE", strike: a, lots: 1 }] },
  { k: "lg", name: "Long strangle", hint: "Cheaper bet on a big move", build: (a, s) => [{ side: 1, type: "CE", strike: a + 2 * s, lots: 1 }, { side: 1, type: "PE", strike: a - 2 * s, lots: 1 }] },
  { k: "sg", name: "Short strangle", hint: "Sell both sides, wider range", build: (a, s) => [{ side: -1, type: "CE", strike: a + 2 * s, lots: 1 }, { side: -1, type: "PE", strike: a - 2 * s, lots: 1 }] },
  { k: "bc", name: "Bull call spread", hint: "Defined risk, mildly bullish", build: (a, s) => [{ side: 1, type: "CE", strike: a, lots: 1 }, { side: -1, type: "CE", strike: a + 2 * s, lots: 1 }] },
  { k: "bp", name: "Bear put spread", hint: "Defined risk, mildly bearish", build: (a, s) => [{ side: 1, type: "PE", strike: a, lots: 1 }, { side: -1, type: "PE", strike: a - 2 * s, lots: 1 }] },
  { k: "ic", name: "Iron condor", hint: "Defined risk, range-bound", build: (a, s) => [{ side: -1, type: "CE", strike: a + 2 * s, lots: 1 }, { side: 1, type: "CE", strike: a + 4 * s, lots: 1 }, { side: -1, type: "PE", strike: a - 2 * s, lots: 1 }, { side: 1, type: "PE", strike: a - 4 * s, lots: 1 }] },
  { k: "ib", name: "Iron butterfly", hint: "Defined risk, tight range", build: (a, s) => [{ side: -1, type: "CE", strike: a, lots: 1 }, { side: -1, type: "PE", strike: a, lots: 1 }, { side: 1, type: "CE", strike: a + 3 * s, lots: 1 }, { side: 1, type: "PE", strike: a - 3 * s, lots: 1 }] },
];

let uid = 1;
const W = 640, H = 300, PAD = { l: 8, r: 8, t: 14, b: 26 };

export default function StrategiesPage() {
  const [und, setUnd] = useState<Und>("NIFTY");
  const cfg = U[und];
  const { quotes } = useQuotes([und]);
  const live = quotes[und];
  const spot = live ?? cfg.spot;
  const atm = Math.round(spot / cfg.step) * cfg.step;
  const [days, setDays] = useState(7);
  const [ivp, setIvp] = useState(14);
  const [lotSize, setLotSize] = useState(cfg.lot);
  const [preset, setPreset] = useState("ss");
  const [legs, setLegs] = useState<Leg[]>([]);
  const [target, setTarget] = useState<number | null>(null);

  useEffect(() => { setLotSize(U[und].lot); }, [und]);
  const touched = useRef(false);
  const liveSeeded = useRef(false);
  useEffect(() => { // fill the first strategy, and refit it once when the live price arrives, until the user edits
    if (touched.current) return;
    if (legs.length && (live == null || liveSeeded.current)) return;
    if (live != null) liveSeeded.current = true;
    const p = PRESETS.find((x) => x.k === preset)!;
    setLegs(p.build(atm, cfg.step).map((l) => ({ ...l, id: uid++, prem: null })));
  }, [atm, cfg.step, preset, live, legs.length]);

  function apply(k: string) {
    touched.current = true; setPreset(k); setTarget(null);
    const p = PRESETS.find((x) => x.k === k)!;
    setLegs(p.build(atm, cfg.step).map((l) => ({ ...l, id: uid++, prem: null })));
  }
  function changeUnd(u: Und) {
    touched.current = true; setUnd(u); setTarget(null);
    const s = (quotes[u] ?? U[u].spot), a = Math.round(s / U[u].step) * U[u].step;
    const p = PRESETS.find((x) => x.k === preset)!;
    setLegs(p.build(a, U[u].step).map((l) => ({ ...l, id: uid++, prem: null })));
  }
  const upd = (id: number, patch: Partial<Leg>) => { touched.current = true; setLegs((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l))); };

  const iv = ivp / 100;
  const priced = useMemo(() => legs.map((l) => ({ ...l, p: l.prem ?? r05(bs(l.type, spot, l.strike, days, iv)) })), [legs, spot, days, iv]);
  const qty = (l: Leg) => l.lots * lotSize;
  const expiryPnl = (S: number) => priced.reduce((t, l) => t + l.side * ((l.type === "CE" ? Math.max(S - l.strike, 0) : Math.max(l.strike - S, 0)) - l.p) * qty(l), 0);
  const todayPnl = (S: number) => priced.reduce((t, l) => t + l.side * (bs(l.type, S, l.strike, days, iv) - l.p) * qty(l), 0);

  const calc = useMemo(() => {
    const lo = spot * 0.88, hi = spot * 1.12, N = 160;
    const xs = Array.from({ length: N + 1 }, (_, i) => lo + ((hi - lo) * i) / N);
    const ex = xs.map(expiryPnl), td = xs.map(todayPnl);
    const bes: number[] = [];
    for (let i = 1; i < xs.length; i++) if ((ex[i - 1] < 0 && ex[i] >= 0) || (ex[i - 1] > 0 && ex[i] <= 0)) bes.push(xs[i - 1] + ((xs[i] - xs[i - 1]) * Math.abs(ex[i - 1])) / (Math.abs(ex[i - 1]) + Math.abs(ex[i])));
    const wide = [0, ...Array.from({ length: 400 }, (_, i) => (spot * 3 * i) / 399)];
    const all = wide.map(expiryPnl).concat(ex);
    let max = Math.max(...all), min = Math.min(...all);
    const slopeHi = expiryPnl(spot * 6 + 1000) - expiryPnl(spot * 6);
    const unlimitedProfit = slopeHi > 1e-6, unlimitedLoss = slopeHi < -1e-6;
    const net = priced.reduce((t, l) => t - l.side * l.p * qty(l), 0); // + means credit received
    return { xs, ex, td, bes, max, min, unlimitedProfit, unlimitedLoss, net };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priced, spot, days, iv, lotSize]);

  const ys = [...calc.ex, ...calc.td];
  const yMax = Math.max(1, ...ys) * 1.12, yMin = Math.min(-1, ...ys) * 1.12;
  const X = (S: number) => PAD.l + ((S - calc.xs[0]) / (calc.xs[calc.xs.length - 1] - calc.xs[0])) * (W - PAD.l - PAD.r);
  const Y = (v: number) => PAD.t + ((yMax - v) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const path = (v: number[]) => v.map((y, i) => `${i ? "L" : "M"}${X(calc.xs[i]).toFixed(1)} ${Y(y).toFixed(1)}`).join(" ");
  const zero = Y(0);
  const tgt = target ?? spot;
  const money = (v: number) => inr(Math.round(v));
  const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "");

  return (
    <>
      <PageHead title="Strategies" sub="Build an options strategy and see the profit and loss at any price. This is a calculator, it does not place orders."
        actions={<Link className="pt-btn" href="/terminal">Open terminal</Link>} />

      <section className="pt-card">
        <div className="sb-top">
          <div className="pt-tabsbar" role="tablist">{(Object.keys(U) as Und[]).map((u) => <button key={u} role="tab" aria-selected={u === und} onClick={() => changeUnd(u)}>{U[u].name}</button>)}</div>
          <div className="sb-spot"><small>{live != null ? "Live price" : "Reference price"}</small><b>{num(spot)}</b></div>
        </div>
        <div className="sb-presets">
          {PRESETS.map((p) => <button key={p.k} className={preset === p.k ? "on" : ""} onClick={() => apply(p.k)}><b>{p.name}</b><small>{p.hint}</small></button>)}
        </div>
      </section>

      <div className="sb-grid">
        <section className="pt-card sb-chart">
          <div className="sb-stats">
            <div><small>Max profit</small><b className="up">{calc.unlimitedProfit ? "Unlimited" : money(calc.max)}</b></div>
            <div><small>Max loss</small><b className="down">{calc.unlimitedLoss ? "Unlimited" : money(calc.min)}</b></div>
            <div><small>{calc.net >= 0 ? "Credit received" : "Cost to enter"}</small><b>{money(Math.abs(calc.net))}</b></div>
            <div><small>Breakeven</small><b>{calc.bes.length ? calc.bes.map((b) => num(b, 0)).join(" · ") : "None"}</b></div>
          </div>
          <svg className="sb-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Profit and loss at expiry">
            <defs>
              <clipPath id="sb-up"><rect x="0" y="0" width={W} height={Math.max(0, zero)} /></clipPath>
              <clipPath id="sb-dn"><rect x="0" y={zero} width={W} height={Math.max(0, H - zero)} /></clipPath>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + f * (H - PAD.t - PAD.b)} y2={PAD.t + f * (H - PAD.t - PAD.b)} className="sb-g" />)}
            <path d={`${path(calc.ex)} L${X(calc.xs[calc.xs.length - 1])} ${zero} L${X(calc.xs[0])} ${zero}Z`} className="sb-fa" clipPath="url(#sb-up)" />
            <path d={`${path(calc.ex)} L${X(calc.xs[calc.xs.length - 1])} ${zero} L${X(calc.xs[0])} ${zero}Z`} className="sb-fb" clipPath="url(#sb-dn)" />
            <line x1={PAD.l} x2={W - PAD.r} y1={zero} y2={zero} className="sb-z" />
            <path d={path(calc.td)} className="sb-today" />
            <path d={path(calc.ex)} className="sb-exp" />
            <line x1={X(spot)} x2={X(spot)} y1={PAD.t} y2={H - PAD.b} className="sb-spotl" />
            {calc.bes.map((b) => <circle key={b} cx={X(b)} cy={zero} r="4.5" className="sb-be" />)}
            <line x1={X(Math.min(Math.max(tgt, calc.xs[0]), calc.xs[calc.xs.length - 1]))} x2={X(Math.min(Math.max(tgt, calc.xs[0]), calc.xs[calc.xs.length - 1]))} y1={PAD.t} y2={H - PAD.b} className="sb-tl" />
            <text x={PAD.l} y={H - 8} className="sb-ax">{num(calc.xs[0], 0)}</text>
            <text x={W - PAD.r} y={H - 8} className="sb-ax" textAnchor="end">{num(calc.xs[calc.xs.length - 1], 0)}</text>
            <text x={X(spot)} y={H - 8} className="sb-ax" textAnchor="middle">Now</text>
          </svg>
          <div className="sb-key"><span><i className="e" />At expiry</span><span><i className="t" />Today</span><span><i className="s" />Current price</span></div>
          <div className="sb-scrub">
            <label htmlFor="sbT">If {cfg.name} is at <b>{num(tgt, 0)}</b></label>
            <input id="sbT" type="range" min={Math.round(calc.xs[0])} max={Math.round(calc.xs[calc.xs.length - 1])} step={cfg.step / 5} value={tgt} onChange={(e) => setTarget(Number(e.target.value))} />
            <div className="sb-res"><div><small>At expiry</small><b className={tone(expiryPnl(tgt))}>{money(expiryPnl(tgt))}</b></div><div><small>Today</small><b className={tone(todayPnl(tgt))}>{money(todayPnl(tgt))}</b></div></div>
          </div>
        </section>

        <section className="pt-card sb-legs">
          <div className="pt-ch"><h2>Legs</h2><button className="pt-link" onClick={() => { touched.current = true; setLegs((ls) => [...ls, { id: uid++, side: 1, type: "CE", strike: atm, lots: 1, prem: null }]); }}>+ Add leg</button></div>
          <div className="sb-lg">
            {priced.map((l) => (
              <div key={l.id} className="sb-leg">
                <div className="sb-l1">
                  <button className={`sb-bs ${l.side === 1 ? "buy" : "sell"}`} onClick={() => upd(l.id, { side: (l.side * -1) as 1 | -1 })} aria-label="Switch buy or sell">{l.side === 1 ? "Buy" : "Sell"}</button>
                  <button className="sb-ty" onClick={() => upd(l.id, { type: l.type === "CE" ? "PE" : "CE" })} aria-label="Switch call or put">{l.type === "CE" ? "Call" : "Put"}</button>
                  <button className="sb-x" onClick={() => { touched.current = true; setLegs((ls) => ls.filter((x) => x.id !== l.id)); }} aria-label="Remove leg">✕</button>
                </div>
                <div className="sb-l2">
                  <label>Strike<span className="sb-step"><button onClick={() => upd(l.id, { strike: l.strike - cfg.step })} aria-label="Lower strike">−</button><b>{l.strike}</b><button onClick={() => upd(l.id, { strike: l.strike + cfg.step })} aria-label="Higher strike">+</button></span></label>
                  <label>Lots<span className="sb-step"><button onClick={() => upd(l.id, { lots: Math.max(1, l.lots - 1) })} aria-label="Fewer lots">−</button><b>{l.lots}</b><button onClick={() => upd(l.id, { lots: l.lots + 1 })} aria-label="More lots">+</button></span></label>
                  <label>Premium<input inputMode="decimal" value={l.prem ?? l.p} onChange={(e) => { const v = e.target.value; upd(l.id, { prem: v === "" || isNaN(Number(v)) ? null : Number(v) }); }} /></label>
                </div>
              </div>
            ))}
            {legs.length === 0 && <p className="pt-empty">Add a leg or pick a ready-made strategy above.</p>}
          </div>
          <div className="sb-set">
            <label>Days to expiry<input inputMode="numeric" value={days} onChange={(e) => setDays(Math.max(0, Math.min(90, Number(e.target.value) || 0)))} /></label>
            <label>Volatility %<input inputMode="decimal" value={ivp} onChange={(e) => setIvp(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} /></label>
            <label>Lot size<input inputMode="numeric" value={lotSize} onChange={(e) => setLotSize(Math.max(1, Number(e.target.value) || 1))} /></label>
          </div>
          <p className="rp-note">Premiums are estimated from the volatility you set. Type your own premium to override. Lot sizes change, so check the exchange list before trading.</p>
        </section>
      </div>
    </>
  );
}
