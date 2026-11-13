import type { Plan } from "./types";

export const inr = (n: number) => (n < 0 ? "-" : "") + "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");

export const sizeLabel = (s: number) => {
  if (s >= 10000000) return "₹" + s / 10000000 + "Cr";
  return "₹" + s / 100000 + "L";
};

const pct = (n: number | null) => (n == null ? null : `${Number(n)}%`);

export const targetText = (p: Plan) => {
  if (p.evaluation_phases === 0) return "None";
  const a = pct(p.phase1_target_pct);
  const b = pct(p.phase2_target_pct);
  return b ? `${a} then ${b}` : (a ?? "None");
};

export const evaluationText = (p: Plan) =>
  p.evaluation_phases === 0 ? "None" : p.evaluation_phases === 1 ? "One phase" : "Two phases";

export const daysText = (p: Plan) =>
  p.evaluation_phases === 2 ? `${p.min_trading_days} profitable days per phase` : `${p.min_trading_days} profitable days`;

export const splitText = (p: Plan) => `${Number(p.reward_split_pct)} / ${100 - Number(p.reward_split_pct)}`;

/** Only allow same-site relative redirects. */
export function safeNext(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
