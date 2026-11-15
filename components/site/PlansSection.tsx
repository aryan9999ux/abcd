"use client";
import Link from "next/link";
import { useState } from "react";
import { PLAN_TAGLINES, type Plan, type PlanPrice } from "./types";
import { daysText, evaluationText, inr, sizeLabel, splitText, targetText } from "./format";

/** Pick the account size once, compare the three plans side by side at that size. */
export default function PlansSection({ plans, prices }: { plans: Plan[]; prices: PlanPrice[] }) {
  const sizes = [...new Set(prices.map((p) => p.account_size))].sort((a, b) => a - b);
  const [size, setSize] = useState<number | null>(null);
  if (!plans.length || !sizes.length) return <p className="muted">Plans are not available right now. Please check back soon.</p>;
  const active = size ?? sizes[Math.min(1, sizes.length - 1)];
  return (
    <>
      <div className="sizebar" role="group" aria-label="Account size">
        {sizes.map((s) => (
          <button key={s} aria-pressed={s === active} onClick={() => setSize(s)}>{sizeLabel(s)}</button>
        ))}
      </div>
      <div className="plans">
        {plans.map((p) => {
          const fee = prices.find((x) => x.plan_key === p.key && x.account_size === active);
          return (
            <div className="glass plan" key={p.key}>
              <div>
                <div className="tag"><h3>{p.name}</h3><span className="pill gold">{evaluationText(p)}</span></div>
                <p className="sub">{PLAN_TAGLINES[p.key] ?? ""}</p>
              </div>
              <div>
                <div className="price mono">{fee ? inr(fee.price_inr) : "—"}</div>
                <p className="muted" style={{ fontSize: ".8rem", marginTop: 8 }}>One-time fee · {inr(active)} simulated account</p>
              </div>
              <Link className="btn primary" href={`/checkout?plan=${p.key}&size=${active}`}>Start {p.name}</Link>
              <ul className="rules">
                <li><span>Profit target</span><span>{targetText(p)}</span></li>
                <li><span>Max daily loss</span><span>{Number(p.max_daily_loss_pct)}%</span></li>
                <li><span>Max overall loss</span><span>{Number(p.max_overall_loss_pct)}%</span></li>
                <li><span>Profitable days</span><span>{daysText(p)}</span></li>
                <li><span>Reward split</span><span className="up">{splitText(p)}</span></li>
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
