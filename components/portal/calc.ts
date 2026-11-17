import { PLAN_RULES, type PlanRules } from "@/lib/rules";
import { drawdownFloor } from "@/lib/engine/pure";
import type { AccountRow } from "@/components/trading/types";
import type { AccountMetrics } from "@/components/trading/metrics";

export const rulesOf = (a: AccountRow): PlanRules => (a.rules ?? PLAN_RULES[a.plan_key] ?? PLAN_RULES.one_step) as PlanRules;

export const compact = (n: number) => (n >= 10_000_000 ? `₹${+(n / 10_000_000).toFixed(2)}Cr` : n >= 100_000 ? `₹${+(n / 100_000).toFixed(2)}L` : `₹${Math.round(n / 1000)}K`);

/** Everything a card needs to say about one account: where it is in the journey and how close each limit is. */
export function accountView(a: AccountRow, m: AccountMetrics | null) {
  const r = rulesOf(a);
  const size = a.account_size;
  const equity = m ? m.equity : a.balance;
  const peak = Math.max(Number(a.peak_eod_balance ?? size), size);
  const floor = drawdownFloor({ accountSize: size, drawdownPct: r.drawdownPct, drawdownType: r.drawdownType, peakEod: peak });
  const idx = a.phase === "phase_1" ? 0 : a.phase === "phase_2" ? 1 : -1;
  const targetPct = idx >= 0 ? r.targetsPct[idx] ?? null : null;
  const targetAmt = targetPct != null ? (size * targetPct) / 100 : null;
  const profit = a.balance - size;
  const dailyLimit = (size * r.dailyLossPct) / 100;
  const dailyUsed = Math.max(0, a.day_start_equity - equity);
  const ddLimit = Math.max(1, peak - floor);
  const ddUsed = Math.max(0, peak - equity);
  const steps = r.targetsPct.length;
  const stages = [...Array.from({ length: steps }, (_, i) => `Phase ${i + 1}`), "Funded"];
  const stage = a.phase === "funded" ? steps : Math.max(0, idx);
  return { r, size, equity, floor, targetPct, targetAmt, profit, dailyLimit, dailyUsed, ddLimit, ddUsed, stages, stage, dayPl: equity - a.day_start_equity, pl: equity - size };
}
export type AccountVM = ReturnType<typeof accountView>;
