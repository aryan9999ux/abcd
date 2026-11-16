"use client";
import { useState } from "react";
import { inr, sizeLabel } from "../site/format";
import { Tween } from "../site/Num";

/** Illustration only: shows the split arithmetic for a chosen account size and monthly return. */
export default function Earn({ sizes, split, ownCap }: { sizes: number[]; split: number; ownCap: number }) {
  const [size, setSize] = useState(sizes[sizes.length - 1] ?? 1000000);
  const [pct, setPct] = useState(6);
  const mine = (size * pct * split) / 10000;
  const alone = (ownCap * pct) / 100;
  const ratio = Math.max(0.04, Math.min(1, alone / Math.max(mine, 1)));
  return (
    <div className="earn">
      <div className="earn-l">
        <div className="lx-sizes" role="group" aria-label="Account size">
          {sizes.map((s) => (<button key={s} aria-pressed={s === size} onClick={() => setSize(s)}>{sizeLabel(s)}</button>))}
        </div>
        <label className="earn-r">
          <span>If you make <b>{pct}%</b> in a month</span>
          <input type="range" min={1} max={10} step={1} value={pct} onChange={(e) => setPct(Number(e.target.value))} aria-label="Monthly profit percentage" />
        </label>
        <div className="earn-out">
          <small>You take home</small>
          <b><Tween value={mine} format={inr} /></b>
          <span>from a {sizeLabel(size)} account, after our {100 - split}% share</span>
        </div>
      </div>
      <div className="lx-bars earn-r2">
        <div className="row">
          <span>Your own {sizeLabel(ownCap)}</span>
          <div className="bar"><i style={{ "--w": `${ratio * 100}%` } as React.CSSProperties} /></div>
          <b>{inr(alone)}</b>
        </div>
        <div className="row win">
          <span>{sizeLabel(size)} funded</span>
          <div className="bar"><i style={{ "--w": "100%" } as React.CSSProperties} /></div>
          <b>{inr(mine)}</b>
        </div>
        <p className="muted">Example only. It shows the maths, not a promise of profit. Payouts follow the Terms.</p>
      </div>
    </div>
  );
}
