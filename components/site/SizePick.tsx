"use client";
import { useState } from "react";
import { Tween } from "./Num";
import { inr, sizeLabel } from "./format";

/** Hero size picker: tap a size, the big number scrubs to it. */
export default function SizePick({ sizes, fees }: { sizes: number[]; fees: Record<number, number | null> }) {
  const [s, setS] = useState(sizes[sizes.length - 1] ?? 1000000);
  const fee = fees[s];
  return (
    <div className="sizepick" data-reveal>
      <div className="chips" role="group" aria-label="Account size">
        {sizes.map((x) => (
          <button key={x} aria-pressed={x === s} onClick={() => setS(x)}>{sizeLabel(x)}</button>
        ))}
      </div>
      <div className="bign"><Tween value={s} format={inr} /></div>
      <p className="muted">in buying power{fee != null ? <> · from <b className="gold">{inr(fee)}</b></> : null}</p>
    </div>
  );
}
