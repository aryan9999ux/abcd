"use client";
import { useState } from "react";
import { inr, sizeLabel } from "./format";
import { Tween } from "./Num";

/** Shows the split arithmetic only. It is an illustration, not a forecast. */
export default function RewardCalc({ sizes, split }: { sizes: number[]; split: number }) {
  const [size, setSize] = useState(sizes[Math.min(1, sizes.length - 1)] ?? 500000);
  const [pct, setPct] = useState(8);
  const profit = (size * pct) / 100;
  return (
    <div className="glass calc">
      <label>Account size
        <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
          {sizes.map((s) => <option key={s} value={s}>{sizeLabel(s)}</option>)}
        </select>
      </label>
      <label>Profit made: <b className="mono" style={{ color: "var(--fg)" }}>{pct}%</b>
        <input type="range" min={1} max={20} step={1} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
      </label>
      <div className="ln"><span className="muted">Total profit</span><b className="mono up"><Tween value={profit} format={inr} /></b></div>
      <div className="ln"><span className="muted">Firm share ({100 - split}%)</span><b className="mono"><Tween value={(profit * (100 - split)) / 100} format={inr} /></b></div>
      <div><span className="muted" style={{ fontSize: ".82rem" }}>Your reward ({split}%)</span><div className="out mono"><Tween value={(profit * split) / 100} format={inr} /></div></div>
      <p className="muted" style={{ fontSize: ".76rem" }}>Example arithmetic. Not a promise of profit. Rewards follow the Terms and payout rules.</p>
    </div>
  );
}
