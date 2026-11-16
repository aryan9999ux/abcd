"use client";
import { useState } from "react";
import { Tween } from "./Num";
import { inr, sizeLabel } from "./format";

/** The honest FOMO engine: the same month, on your capital vs on ours. */
export default function EdgeCalc({ size, fee, split }: { size: number; fee: number | null; split: number }) {
  const [pct, setPct] = useState(3);
  const own = 100000;
  return (
    <div className="glass edge spot" data-reveal>
      <div className="erow">
        <label htmlFor="epct">Say your month ends at</label>
        <b className="gold mono">+{pct.toFixed(1).replace(/\.0$/, "")}%</b>
      </div>
      <input id="epct" type="range" min={1} max={10} step={0.5} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
      <div className="eduel">
        <div className="side">
          <span>On your own {sizeLabel(own)}</span>
          <b className="mono"><Tween value={(own * pct) / 100} format={inr} /></b>
          <em>with your savings carrying every rupee of the risk</em>
        </div>
        <div className="side win">
          <span>On a {sizeLabel(size)} account here</span>
          <b className="mono"><Tween value={((size * pct) / 100) * (split / 100)} format={inr} /></b>
          <em>your share at {split}% — risk capped at {fee != null ? `the ${inr(fee)} fee` : "the fee"}</em>
        </div>
      </div>
      <p className="ecap muted">Example arithmetic at the size you pick. Not a promise of profit.</p>
    </div>
  );
}
