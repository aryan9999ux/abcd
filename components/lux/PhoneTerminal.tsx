"use client";
import { useEffect, useState } from "react";

/* Deterministic candles so server and client render the same markup. */
const N = 28;
const RAW = (() => {
  let s = 11;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let p = 50;
  return Array.from({ length: N }, () => {
    const o = p, c = o + (rnd() - 0.36) * 8 + 0.85;
    const hi = Math.max(o, c) + rnd() * 3.5, lo = Math.min(o, c) - rnd() * 3.5;
    p = c;
    return { o, c, hi, lo };
  });
})();
const MIN = Math.min(...RAW.map((k) => k.lo)), MAX = Math.max(...RAW.map((k) => k.hi));
const Y = (v: number) => +(124 - ((v - MIN) / (MAX - MIN)) * 104).toFixed(1);
const CANDLES = RAW.map((k, i) => ({ x: +(14 + i * 10.6).toFixed(1), yo: Y(k.o), yc: Y(k.c), yh: Y(k.hi), yl: Y(k.lo), up: k.c >= k.o }));
const LAST = CANDLES[CANDLES.length - 1];
const CHAIN = [[62, 8], [48, 12], [34, 19], [24, 27], [16, 38], [10, 50], [6, 64]];

/** Phone-only terminal picture. Candles draw in once, the price ticks, tabs switch. Illustration only. */
export default function PhoneTerminal() {
  const [px, setPx] = useState(24186.4);
  const [dir, setDir] = useState<"up" | "dn">("up");
  const [tab, setTab] = useState<"chart" | "chain">("chart");
  useEffect(() => {
    const id = setInterval(() => setPx((p) => {
      const n = p + (Math.random() - 0.46) * 5;
      setDir(n >= p ? "up" : "dn");
      return Math.min(24230, Math.max(24150, n));
    }), 1400);
    return () => clearInterval(id);
  }, []);
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const chg = ((px - 23990) / 23990) * 100;

  return (
    <div className="pt" aria-hidden>
      <div className="pt-glow" />
      <div className="pt-card">
        <div className="pt-top">
          <div>
            <span className="pt-sym">NIFTY FUT</span>
            <b className={`pt-px ${dir}`}>{fmt(px)}</b>
          </div>
          <div className="pt-r">
            <span className="pt-live"><i />Live</span>
            <span className={`pt-chg ${chg >= 0 ? "up" : "dn"}`}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</span>
          </div>
        </div>
        <div className="pt-tabs">
          <button type="button" className={tab === "chart" ? "on" : ""} onClick={() => setTab("chart")}>Chart</button>
          <button type="button" className={tab === "chain" ? "on" : ""} onClick={() => setTab("chain")}>Option chain</button>
        </div>
        {tab === "chart" ? (
          <svg className="pt-chart" viewBox="0 0 320 140" preserveAspectRatio="none">
            <defs>
              <linearGradient id="ptg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8b5cf6" stopOpacity=".28" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient>
            </defs>
            {[28, 62, 96].map((y) => <line key={y} x1="0" x2="320" y1={y} y2={y} className="pt-grid" />)}
            <path className="pt-area" d={`M${CANDLES[0].x} ${CANDLES[0].yc} ${CANDLES.map((c) => `L${c.x} ${c.yc}`).join(" ")} L${LAST.x} 140 L${CANDLES[0].x} 140Z`} fill="url(#ptg)" />
            {CANDLES.map((c, i) => (
              <g key={i} className={`pt-k ${c.up ? "up" : "dn"}`} style={{ animationDelay: `${0.25 + i * 0.04}s` }}>
                <line x1={c.x} x2={c.x} y1={c.yh} y2={c.yl} />
                <rect x={c.x - 3.2} width="6.4" y={Math.min(c.yo, c.yc)} height={Math.max(2, Math.abs(c.yo - c.yc))} rx="1.2" />
              </g>
            ))}
            <line className="pt-ref" x1="0" x2="296" y1={LAST.yc} y2={LAST.yc} />
            <circle className="pt-dot" cx={LAST.x} cy={LAST.yc} r="3.4" />
            <circle className="pt-ping" cx={LAST.x} cy={LAST.yc} r="3.4" />
          </svg>
        ) : (
          <div className="pt-chain">
            <div className="pt-ch-h"><span>Calls</span><span>Strike</span><span>Puts</span></div>
            {CHAIN.map(([a, b], i) => (
              <div key={i} className={`pt-ch-r${i === 3 ? " atm" : ""}`}>
                <span className="ce"><i style={{ width: `${a}%`, animationDelay: `${i * 50}ms` }} /></span>
                <b>{24000 + (i - 3) * 100}</b>
                <span className="pe"><i style={{ width: `${b}%`, animationDelay: `${i * 50}ms` }} /></span>
              </div>
            ))}
          </div>
        )}
        <div className="pt-limits">
          <div><span>Daily loss</span><b>1.2% <small>of 4%</small></b><i><em style={{ "--w": "30%" } as React.CSSProperties} className="ok" /></i></div>
          <div><span>Drawdown</span><b>2.8% <small>of 10%</small></b><i><em style={{ "--w": "28%" } as React.CSSProperties} className="ok" /></i></div>
          <div><span>Profit target</span><b>62% <small>done</small></b><i><em style={{ "--w": "62%" } as React.CSSProperties} className="hi" /></i></div>
        </div>
      </div>
      <p className="pt-note">Terminal preview. Layout illustration.</p>
    </div>
  );
}
