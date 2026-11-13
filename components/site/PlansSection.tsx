"use client";
import Link from "next/link";
import { useState } from "react";
import { PLAN_TAGLINES, type Plan, type PlanPrice } from "./types";
import { daysText, inr, sizeLabel, splitText, targetText } from "./format";

export default function PlansSection({ plans, prices }: { plans: Plan[]; prices: PlanPrice[] }) {
  const [key, setKey] = useState(plans[plans.length - 1]?.key ?? plans[0]?.key);
  const [size, setSize] = useState<number | null>(null);

  const plan = plans.find((p) => p.key === key) ?? plans[0];
  if (!plan) return <p className="muted">Plans are not available right now. Please check back soon.</p>;

  const list = prices.filter((x) => x.plan_key === plan.key).sort((a, b) => a.account_size - b.account_size);
  const active = list.find((x) => x.account_size === size) ?? list[0];

  return (
    <>
      <div className="tabs glass" role="tablist" aria-label="Plan type">
        {plans.map((p) => (
          <button key={p.key} role="tab" aria-selected={p.key === plan.key} onClick={() => setKey(p.key)}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="planbox glass">
        <div className="l">
          <div>
            <span className="pill gold">{plan.name}</span>
            <p className="muted" style={{ marginTop: 8 }}>{PLAN_TAGLINES[plan.key] ?? ""}</p>
          </div>
          <div className="sizes">
            {list.map((x) => (
              <button key={x.account_size} aria-pressed={x.account_size === active?.account_size} onClick={() => setSize(x.account_size)}>
                {sizeLabel(x.account_size)}
              </button>
            ))}
          </div>
          {active && (
            <>
              <div>
                <div className="price mono">{inr(active.price_inr)}</div>
                <p className="muted" style={{ fontSize: ".82rem", marginTop: 6 }}>
                  One-time platform fee for a {inr(active.account_size)} simulated account
                </p>
              </div>
              <Link className="btn primary" href={`/checkout?plan=${plan.key}&size=${active.account_size}`}>
                Get {plan.name} {sizeLabel(active.account_size)}
              </Link>
            </>
          )}
        </div>
        <div>
          <ul className="rules">
            <li><span>Account size</span><span>{active ? inr(active.account_size) : "-"}</span></li>
            <li><span>Profit target</span><span>{targetText(plan)}</span></li>
            <li><span>Max daily loss</span><span>{Number(plan.max_daily_loss_pct)}%</span></li>
            <li><span>Max overall loss</span><span>{Number(plan.max_overall_loss_pct)}%</span></li>
            <li><span>Minimum trading days</span><span>{daysText(plan)}</span></li>
            <li><span>Reward split</span><span className="up">{splitText(plan)}</span></li>
          </ul>
        </div>
      </div>
    </>
  );
}
