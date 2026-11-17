import { PLAN_RULES, type PlanRules } from "@/lib/rules";
import { inr, sizeLabel } from "./format";
import type { Plan } from "./types";

export const planRules = (p: Pick<Plan, "key"> & { rules?: PlanRules | null }): PlanRules => p.rules ?? PLAN_RULES[p.key] ?? PLAN_RULES.one_step;

const hhmm = (s: string) => { const [h, m] = s.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };

/** The plain-English "what you get" list for a plan at a given account size. Same numbers the engine enforces. */
export function planFacts(plan: Plan & { rules?: PlanRules | null }, size: number): { k: string; v: string }[] {
  const r = planRules(plan);
  const steps = r.targetsPct.length;
  const rows: { k: string; v: string }[] = [
    { k: "Account size", v: sizeLabel(size) },
    { k: "Test before funding", v: steps === 0 ? "None. You start funded." : steps === 1 ? `1 step: make ${r.targetsPct[0]}% profit` : `2 steps: make ${r.targetsPct[0]}%, then ${r.targetsPct[1]}%` },
    { k: "Max loss in a day", v: `${r.dailyLossPct}% (${inr((size * r.dailyLossPct) / 100)})` },
    { k: "Max total loss", v: `${r.drawdownPct}% (${inr((size * r.drawdownPct) / 100)})${r.drawdownType === "trailing" ? ", moves up with your profit" : ""}` },
    { k: "Your share of profit", v: `${r.payout.splitPct}%` },
    { k: "Payouts", v: `Every ${r.payout.cycleDays} days, from ${inr(r.payout.minPayoutInr)}` },
  ];
  if (r.payout.feeRefundAtPayout) rows.push({ k: "Your fee", v: `Returned with payout number ${r.payout.feeRefundAtPayout}` });
  rows.push({ k: "Trading", v: `Stocks, futures and options. No new trades after ${hhmm(r.entryCutoffIST)}.` });
  return rows;
}
