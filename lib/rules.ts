/**
 * Plan rules. One JSON document per plan (plans.rules), copied onto each account at purchase so a running
 * account is never changed by later edits. The engine enforces these numbers and the public rules page is
 * generated from the same document, so what is shown and what is enforced cannot differ.
 * No server-only imports here: the type and helpers are shared with the site.
 */
export interface PlanRules {
  version: string;
  dailyLossPct: number;            // of starting balance, open positions count
  drawdownPct: number;             // of starting balance
  drawdownType: "static" | "trailing";
  targetsPct: number[];            // one per evaluation phase; [] for instant funding
  evalProfitableDay: { pct: number; days: number };   // closed day at least +pct% of start, needed `days` times per phase
  fundedProfitableDay: { pct: number; days: number }; // same, per payout cycle
  riskPerTradePct: number;         // |entry - stop| x qty, of current balance
  maxOpenPositions: number;        // one more breaches the account
  minHoldSeconds: number;
  entryCutoffIST: string;          // "15:15", no new positions from this time
  ideaCapPctOfDaily: number;       // one underlying, one direction, one day: total risk cap as % of the daily loss limit
  largestTradeMultiple: number | null; // risk of a new trade vs average of this cycle's trades
  payout: {
    cycleDays: number;
    minProfitPct: number;          // closed profit above start needed to request
    minPayoutInr: number;
    splitPct: number;
    feeRefundAtPayout: number | null; // the fee is returned with this payout number
  };
}

export const PLAN_RULES: Record<string, PlanRules> = {
  instant: {
    version: "1.0", dailyLossPct: 4, drawdownPct: 10, drawdownType: "trailing", targetsPct: [],
    evalProfitableDay: { pct: 0.2, days: 7 }, fundedProfitableDay: { pct: 0.2, days: 7 },
    riskPerTradePct: 1.5, maxOpenPositions: 2, minHoldSeconds: 60, entryCutoffIST: "15:15",
    ideaCapPctOfDaily: 40, largestTradeMultiple: 3,
    payout: { cycleDays: 14, minProfitPct: 3, minPayoutInr: 5000, splitPct: 80, feeRefundAtPayout: null },
  },
  one_step: {
    version: "1.0", dailyLossPct: 4, drawdownPct: 8, drawdownType: "static", targetsPct: [10],
    evalProfitableDay: { pct: 0.2, days: 5 }, fundedProfitableDay: { pct: 0.1, days: 5 },
    riskPerTradePct: 1.5, maxOpenPositions: 3, minHoldSeconds: 60, entryCutoffIST: "15:15",
    ideaCapPctOfDaily: 40, largestTradeMultiple: 3,
    payout: { cycleDays: 14, minProfitPct: 3, minPayoutInr: 5000, splitPct: 80, feeRefundAtPayout: 3 },
  },
  two_step: {
    version: "1.0", dailyLossPct: 4, drawdownPct: 8, drawdownType: "static", targetsPct: [8, 5],
    evalProfitableDay: { pct: 0.1, days: 5 }, fundedProfitableDay: { pct: 0.1, days: 5 },
    riskPerTradePct: 1.5, maxOpenPositions: 3, minHoldSeconds: 60, entryCutoffIST: "15:15",
    ideaCapPctOfDaily: 40, largestTradeMultiple: 3,
    payout: { cycleDays: 14, minProfitPct: 3, minPayoutInr: 5000, splitPct: 80, feeRefundAtPayout: 3 },
  },
};

/** Validate a rules document coming from the admin editor. Returns an error message or null. */
export function validateRules(r: unknown): string | null {
  const x = r as PlanRules;
  if (!x || typeof x !== "object") return "Rules must be a JSON object.";
  const n = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
  if (typeof x.version !== "string" || !x.version) return "version is required.";
  if (!n(x.dailyLossPct, 0.1, 50)) return "dailyLossPct must be between 0.1 and 50.";
  if (!n(x.drawdownPct, 0.1, 90)) return "drawdownPct must be between 0.1 and 90.";
  if (x.drawdownType !== "static" && x.drawdownType !== "trailing") return "drawdownType must be static or trailing.";
  if (!Array.isArray(x.targetsPct) || x.targetsPct.length > 2 || !x.targetsPct.every((t) => n(t, 0.1, 200))) return "targetsPct must have 0 to 2 numbers.";
  for (const k of ["evalProfitableDay", "fundedProfitableDay"] as const) {
    if (!x[k] || !n(x[k].pct, 0, 20) || !n(x[k].days, 0, 60)) return `${k} needs pct and days.`;
  }
  if (!n(x.riskPerTradePct, 0.05, 20)) return "riskPerTradePct must be between 0.05 and 20.";
  if (!n(x.maxOpenPositions, 1, 50)) return "maxOpenPositions must be between 1 and 50.";
  if (!n(x.minHoldSeconds, 0, 3600)) return "minHoldSeconds must be between 0 and 3600.";
  if (typeof x.entryCutoffIST !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.entryCutoffIST)) return "entryCutoffIST must look like 15:15.";
  if (!n(x.ideaCapPctOfDaily, 1, 100)) return "ideaCapPctOfDaily must be between 1 and 100.";
  if (x.largestTradeMultiple !== null && !n(x.largestTradeMultiple, 1, 100)) return "largestTradeMultiple must be a number or null.";
  const p = x.payout;
  if (!p || !n(p.cycleDays, 1, 365) || !n(p.minProfitPct, 0, 100) || !n(p.minPayoutInr, 0, 1e8) || !n(p.splitPct, 1, 100)) return "payout settings are incomplete.";
  if (p.feeRefundAtPayout !== null && !n(p.feeRefundAtPayout, 1, 50)) return "payout.feeRefundAtPayout must be a number or null.";
  return null;
}
