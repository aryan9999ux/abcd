"use client";
import type { Plan } from "./types";
import { PLAN_TAGLINES } from "./types";
import { planRules } from "./planFacts";

const BLURB: Record<string, string> = {
  instant: "Start funded right away. No test to pass.",
  one_step: "Pass one test, then get funded.",
  two_step: "Pass two tests. Lowest fee.",
};

/** Radio list of plans, used by checkout and the demo page. */
export default function PlanPicker({ plans, value, onChange, label = "Choose a plan" }: { plans: Plan[]; value: string | undefined; onChange: (k: string) => void; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="pk">
      {plans.map((p) => {
        const r = planRules(p);
        const on = p.key === value;
        return (
          <button key={p.key} type="button" role="radio" aria-checked={on} className={`pk-row${on ? " on" : ""}`} onClick={() => onChange(p.key)}>
            <span className="pk-dot" aria-hidden />
            <span className="pk-main">
              <b>{p.name}</b>
              <span>{BLURB[p.key] ?? PLAN_TAGLINES[p.key] ?? ""}</span>
            </span>
            <span className="pk-meta">{r.targetsPct.length === 0 ? "No test" : `${r.targetsPct.length} test${r.targetsPct.length > 1 ? "s" : ""}`}</span>
          </button>
        );
      })}
    </div>
  );
}
