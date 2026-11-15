"use client";
import { useState } from "react";
import { inr, sizeLabel } from "./format";

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
      <div className="ln"><span className="muted">Simulated profit</span><b className="mono up">{inr(profit)}</b></div>
      <div className="ln"><span className="muted">Firm share ({100 - split}%)</span><b className="mono">{inr((profit * (100 - split)) / 100)}</b></div>
      <div><span className="muted" style={{ fontSize: ".82rem" }}>Your reward ({split}%)</span><div className="out mono">{inr((profit * split) / 100)}</div></div>
      <p className="muted" style={{ fontSize: ".76rem" }}>Illustration only. It is not a forecast. Rewards follow the Terms and payout rules.</p>
    </div>
  );
}
