"use client";
import Link from "next/link";
import { useState } from "react";
import GoldCard, { type Tier } from "./GoldCard";
import { Tween } from "../site/Num";
import { daysText, evaluationText, inr, sizeLabel, splitText, targetText } from "../site/format";
import type { Plan, PlanPrice } from "../site/types";

const TIER = (p: Plan): Tier => (p.evaluation_phases === 0 ? "black" : p.evaluation_phases === 1 ? "gold" : "titanium");
const TAG = (p: Plan) => (p.evaluation_phases === 0 ? "Funded from day one" : p.evaluation_phases === 1 ? "One phase to funded" : "Lowest fee");

/** Plans as cards. Pick a size once, every card follows. */
export default function Tiers({ plans, prices }: { plans: Plan[]; prices: PlanPrice[] }) {
  const sizes = [...new Set(prices.map((p) => p.account_size))].sort((a, b) => a - b);
  const [size, setSize] = useState<number | null>(null);
  if (!plans.length || !sizes.length) return <p className="muted">Plans are not available right now. Please check back soon.</p>;
  const active = size ?? sizes[Math.min(1, sizes.length - 1)];
  return (
    <>
      <div className="lx-sizes" role="group" aria-label="Account size">
        {sizes.map((s) => (<button key={s} aria-pressed={s === active} onClick={() => setSize(s)}>{sizeLabel(s)}</button>))}
      </div>
      <div className="lx-tiers">
        {plans.map((p, i) => {
          const fee = prices.find((x) => x.plan_key === p.key && x.account_size === active);
          return (
            <article key={p.key} className={`lx-tier${p.evaluation_phases === 1 ? " mid" : ""}`} data-reveal style={{ "--d": `${i * 100}ms` } as React.CSSProperties}>
              <GoldCard tier={TIER(p)} size={sizeLabel(active)} name={p.name} num={String(2026 + i)} />
              <div className="lx-info">
                <span className="lx-tag">{TAG(p)} · {evaluationText(p)}</span>
                <div className="lx-price"><Tween value={fee ? fee.price_inr : 0} format={inr} /><small>one-time</small></div>
                <Link className="btn primary lg" href={`/checkout?plan=${p.key}&size=${active}`}>Get {p.name}</Link>
                <ul>
                  <li><span>Profit target</span><b>{targetText(p)}</b></li>
                  <li><span>Daily loss limit</span><b>{Number(p.max_daily_loss_pct)}%</b></li>
                  <li><span>Overall loss limit</span><b>{Number(p.max_overall_loss_pct)}%</b></li>
                  <li><span>Profitable days</span><b>{daysText(p)}</b></li>
                  <li><span>Your split</span><b className="gold">{splitText(p)}</b></li>
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
