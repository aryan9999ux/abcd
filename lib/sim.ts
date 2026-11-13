import "server-only";
import type { PlanRules } from "./rules";

/**
 * Admin-only Monte Carlo of a plan's economics. Imports server-only so it can never be bundled into the
 * site or the trader pages. Traders are simplified: fixed risk per trade as a share of balance, a win rate
 * and a reward-to-risk ratio. Closed profit/loss only.
 */
export interface Archetype { name: string; share: number; winRate: number; rr: number; tradesPerDay: number; riskPct: number }
export interface SimInput {
  rules: PlanRules; accountSize: number; feeInr: number; traders: number; horizonDays: number; seed: number; archetypes: Archetype[];
  /** Chance that a trader whose account is breached buys a new one, and how many times at most. */
  rebuyProb: number; maxRebuys: number;
}
export interface SimResult {
  traders: number; purchases: number; feeRevenue: number; payoutCost: number; net: number; marginPct: number;
  passedAllPhases: number; breached: number; neverPaid: number; paidAtLeastOnce: number; avgPayoutsPerPaid: number;
  avgRewardPerPaidTrader: number; breachedByDay: number[]; byArchetype: Array<{ name: string; traders: number; breachedPct: number; paidPct: number; avgReward: number }>;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function simulateOne(a: Archetype, i: SimInput, rand: () => number, days: number) {
  const { rules: r, accountSize: size } = i;
  const cycleTradingDays = Math.max(1, Math.round((r.payout.cycleDays * 5) / 7));
  let phaseIdx = r.targetsPct.length === 0 ? -1 : 0; // -1 = funded
  let balance = size, peak = size, dayInCycle = 0, goodDays = 0, payouts = 0, reward = 0;
  for (let day = 1; day <= days; day++) {
    const dayStart = balance;
    const dayPnlStart = balance;
    for (let t = 0; t < a.tradesPerDay; t++) {
      const risk = (a.riskPct / 100) * Math.min(balance, size * 1.5);
      balance += rand() < a.winRate ? risk * a.rr : -risk;
      const floor = r.drawdownType === "static" ? size * (1 - r.drawdownPct / 100) : Math.min(size, Math.max(peak, size) - (size * r.drawdownPct) / 100);
      if (balance <= floor || balance <= dayStart - (size * r.dailyLossPct) / 100) return { breachedDay: day, payouts, reward };
    }
    dayInCycle++;
    const pd = phaseIdx >= 0 ? r.evalProfitableDay : r.fundedProfitableDay;
    if (balance - dayPnlStart >= (size * pd.pct) / 100) goodDays++;
    peak = Math.max(peak, balance);
    if (phaseIdx >= 0) {
      const target = r.targetsPct[phaseIdx];
      if (balance - size >= (size * target) / 100 && goodDays >= pd.days) {
        phaseIdx = phaseIdx + 1 < r.targetsPct.length ? phaseIdx + 1 : -1;
        balance = size; peak = size; dayInCycle = 0; goodDays = 0;
      }
    } else if (dayInCycle >= cycleTradingDays) {
      const profit = balance - size;
      const payable = Math.max(0, profit) * (r.payout.splitPct / 100);
      if (goodDays >= pd.days && profit >= (size * r.payout.minProfitPct) / 100 && payable >= r.payout.minPayoutInr) {
        payouts++;
        reward += payable + (r.payout.feeRefundAtPayout === payouts ? i.feeInr : 0);
        balance = size; peak = size; dayInCycle = 0; goodDays = 0;
      } else if (dayInCycle >= cycleTradingDays * 3) {
        dayInCycle = cycleTradingDays; // keep waiting; eligibility is checked every day from here
      }
    }
  }
  return { breachedDay: 0, payouts, reward, funded: phaseIdx < 0 };
}

export function simulate(i: SimInput): SimResult {
  const rand = rng(i.seed);
  const totalShare = i.archetypes.reduce((s, a) => s + a.share, 0) || 1;
  const buckets = i.archetypes.map((a) => ({ a, n: Math.round((i.traders * a.share) / totalShare), breached: 0, paid: 0, reward: 0 }));
  let purchases = 0, breached = 0, paidTraders = 0, payoutsOnPaid = 0, rewardTotal = 0, passedAll = 0, n = 0;
  const byDay = new Array(Math.min(i.horizonDays, 60) + 1).fill(0);
  for (const b of buckets) {
    for (let k = 0; k < b.n; k++) {
      n++;
      let left = i.horizonDays, buys = 0, again = true, everPaid = false, everFunded = false, tReward = 0, tPayouts = 0, tBreached = false;
      while (again) {
        buys++; purchases++;
        const r = simulateOne(b.a, i, rand, left);
        tReward += r.reward; tPayouts += r.payouts;
        if (r.payouts > 0) everPaid = true;
        if ((r as { funded?: boolean }).funded || r.payouts > 0) everFunded = true;
        if (r.breachedDay) {
          tBreached = true;
          byDay[Math.min(r.breachedDay, byDay.length - 1)]++;
          left -= r.breachedDay;
          again = buys <= i.maxRebuys && left > 10 && rand() < i.rebuyProb;
        } else again = false;
      }
      if (tBreached) { breached++; b.breached++; }
      if (everFunded) passedAll++;
      if (everPaid) { paidTraders++; b.paid++; payoutsOnPaid += tPayouts; }
      rewardTotal += tReward; b.reward += tReward;
    }
  }
  const feeRevenue = Math.round((purchases * i.feeInr) / 1.18); // fees include 18% GST
  const net = feeRevenue - rewardTotal;
  return {
    traders: n, purchases, feeRevenue, payoutCost: Math.round(rewardTotal), net: Math.round(net), marginPct: feeRevenue ? (net / feeRevenue) * 100 : 0,
    passedAllPhases: passedAll, breached, neverPaid: n - paidTraders, paidAtLeastOnce: paidTraders,
    avgPayoutsPerPaid: paidTraders ? payoutsOnPaid / paidTraders : 0, avgRewardPerPaidTrader: paidTraders ? rewardTotal / paidTraders : 0,
    breachedByDay: byDay,
    byArchetype: buckets.map((b) => ({ name: b.a.name, traders: b.n, breachedPct: b.n ? (b.breached / b.n) * 100 : 0, paidPct: b.n ? (b.paid / b.n) * 100 : 0, avgReward: b.n ? b.reward / b.n : 0 })),
  };
}

export const DEFAULT_ARCHETYPES: Archetype[] = [
  { name: "Gamblers (lose over time)", share: 55, winRate: 0.4, rr: 1, tradesPerDay: 3, riskPct: 1.5 },
  { name: "Break-even traders", share: 30, winRate: 0.45, rr: 1.25, tradesPerDay: 2, riskPct: 1 },
  { name: "Careful, small edge", share: 12, winRate: 0.5, rr: 1.4, tradesPerDay: 2, riskPct: 0.7 },
  { name: "Skilled", share: 3, winRate: 0.52, rr: 1.8, tradesPerDay: 2, riskPct: 0.8 },
];
