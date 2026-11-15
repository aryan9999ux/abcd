import { publicClient } from "@/lib/supabase/public";
import Footer from "@/components/site/Footer";
import RulesView, { type RulesPlan } from "@/components/site/RulesView";
import { PLAN_RULES, type PlanRules } from "@/lib/rules";

export const revalidate = 60;
export const metadata = { title: "Rules", description: "Every limit, target and reward rule for each plan." };

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
const clock = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };

function lines(r: PlanRules): [string, string][] {
  const t = r.targetsPct;
  const funded = t.length === 0;
  return [
    ["Account type", funded ? "Funded from day one, no evaluation" : t.length === 1 ? "One evaluation phase, then funded" : "Two evaluation phases, then funded"],
    ["Daily loss limit", `${r.dailyLossPct}% of the starting balance. Open positions count. Touch it and the account closes.`],
    ["Maximum drawdown", r.drawdownType === "trailing"
      ? `${r.drawdownPct}%, trailing. The floor is ${r.drawdownPct}% below your highest end-of-day closed balance, only moves up, and locks at the starting balance once you are ${r.drawdownPct}% in profit.`
      : `${r.drawdownPct}%, static. The floor is fixed at ${100 - r.drawdownPct}% of the starting balance.`],
    ["Profit target", funded ? "None" : t.map((x, i) => `${x}% in phase ${i + 1}`).join(", ") + ". Closed profit only."],
    ["Profitable days", `${(funded ? r.fundedProfitableDay : r.evalProfitableDay).days} days closed at +${(funded ? r.fundedProfitableDay : r.evalProfitableDay).pct}% or more${funded ? " in each reward cycle" : " in each phase"}.` + (funded ? "" : ` In the funded stage: ${r.fundedProfitableDay.days} days at +${r.fundedProfitableDay.pct}% per cycle.`)],
    ["Stop loss", "Required on every trade. An order without a stop loss is not accepted."],
    ["Risk per trade", `The distance from entry to stop loss, times quantity, is at most ${r.riskPerTradePct}% of your current balance.`],
    ["One idea, one day", `One underlying in one direction carries at most ${r.ideaCapPctOfDaily}% of the daily loss limit as total risk per day.`],
    ["Open positions", `At most ${r.maxOpenPositions} at a time. Opening one more closes all positions and ends the account.`],
    ["Minimum hold", `A position stays open at least ${r.minHoldSeconds} seconds before you can close it. Your stop loss works at any time.`],
    ["Entry cutoff", `No new positions from ${clock(r.entryCutoffIST)} IST. Closing is always allowed.`],
    ...(r.largestTradeMultiple ? [["Trade size consistency", `A trade cannot risk more than ${r.largestTradeMultiple}× the average risk of your trades in the cycle.`] as [string, string]] : []),
    ["Reward requests", `Every ${r.payout.cycleDays} days, with all positions closed, KYC verified, closed profit of at least ${r.payout.minProfitPct}% of the starting balance and the profitable days above.`],
    ["Reward amount", `${r.payout.splitPct}% of closed profit. Minimum ${inr(r.payout.minPayoutInr)}. The balance returns to the starting balance after each reward.`],
    ["Fee refund", r.payout.feeRefundAtPayout ? `Your fee is returned with reward number ${r.payout.feeRefundAtPayout}, on top of your share. Not returned if the account is breached or blocked before then.` : "No fee refund on this plan."],
    ["Not allowed", "Copy trading, bots, account sharing, and opposite trades across accounts."],
  ];
}

const GROUPS: [string, string, string[]][] = [
  ["Targets", "What you need to reach", ["Account type", "Profit target", "Profitable days"]],
  ["Loss limits", "Hard limits that close the account", ["Daily loss limit", "Maximum drawdown"]],
  ["Trading conduct", "How every trade must be placed", ["Stop loss", "Risk per trade", "One idea, one day", "Open positions", "Minimum hold", "Entry cutoff", "Trade size consistency", "Not allowed"]],
  ["Rewards", "How and when you get paid", ["Reward requests", "Reward amount", "Fee refund"]],
];

export default async function Rules() {
  const { data } = await publicClient().from("plans").select("key,name,rules,evaluation_phases").eq("active", true).order("evaluation_phases");
  const plans: RulesPlan[] = (data ?? [])
    .map((p) => ({ key: p.key as string, name: p.name as string, rules: (p.rules ?? PLAN_RULES[p.key as string]) as PlanRules | undefined }))
    .filter((p) => p.rules)
    .map((p) => {
      const r = p.rules!;
      const L = new Map(lines(r));
      const funded = r.targetsPct.length === 0;
      return {
        key: p.key, name: p.name, version: r.version,
        tiles: [
          ["Daily loss limit", `${r.dailyLossPct}%`],
          ["Max drawdown", `${r.drawdownPct}% ${r.drawdownType}`],
          ["Profit target", funded ? "None" : r.targetsPct.map((x) => `${x}%`).join(" + ")],
          ["Reward split", `${r.payout.splitPct}%`],
        ] as [string, string][],
        groups: GROUPS.map(([title, note, keys]) => ({ title, note, items: keys.filter((k) => L.has(k)).map((k) => [k, L.get(k)!] as [string, string]) })),
      };
    })
    .sort((a, b) => ["1-step", "2-step", "instant"].findIndex((k) => a.key.includes(k.replace("-", ""))) - ["1-step", "2-step", "instant"].findIndex((k) => b.key.includes(k.replace("-", ""))));
  return (
    <>
      <main className="wrap" style={{ paddingBlock: "56px 80px" }}>
        <h1 style={{ fontSize: "clamp(2.2rem,5vw,3.6rem)" }}>The rules, in plain words</h1>
        <p className="muted" style={{ marginTop: 14, maxWidth: 680 }}>
          These limits are enforced automatically and shown live on your dashboard. Daily loss and drawdown use the starting balance. Risk per trade uses your current balance. All times are IST. Accounts use simulated capital and rewards are performance rewards under the Terms.
        </p>
        <RulesView plans={plans} />
      </main>
      <Footer />
    </>
  );
}
