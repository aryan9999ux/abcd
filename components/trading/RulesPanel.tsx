"use client";
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { PLAN_RULES } from "@/lib/rules";
import { daysBetween, drawdownFloor, istDate, istMinutes, profitableDays } from "@/lib/engine/pure";
import { inr } from "./format";
import { Meter } from "./Meter";
import type { AccountMetrics } from "./metrics";
import type { AccountRow } from "./types";

/** One simple card with every rule of the account and how close the trader is to each. */
export default function RulesPanel({ account, m, openCount }: { account: AccountRow; m: AccountMetrics; openCount: number }) {
  const [pnls, setPnls] = useState<number[]>([]);
  const [kyc, setKyc] = useState(false);
  const [now, setNow] = useState(0); // real time is set after mount so server and browser render the same HTML

  useEffect(() => {
    let alive = true;
    const sb = browserClient();
    const load = async () => {
      const [d, k] = await Promise.all([
        sb.from("day_results").select("pnl").eq("account_id", account.id).eq("cycle_no", account.cycle_no ?? 0),
        sb.from("kyc_status").select("verified").maybeSingle(),
      ]);
      if (!alive) return;
      setPnls((d.data ?? []).map((r: { pnl: unknown }) => Number(r.pnl)));
      setKyc(!!k.data?.verified);
      setNow(Date.now());
    };
    void load();
    const t = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(t); };
  }, [account.id, account.cycle_no, account.balance]);

  const r = account.rules ?? PLAN_RULES[account.plan_key];
  if (!r) return null;
  const size = account.account_size;
  const funded = account.phase === "funded";
  const peak = Number(account.peak_eod_balance ?? size);
  const floor = drawdownFloor({ accountSize: size, drawdownPct: r.drawdownPct, drawdownType: r.drawdownType, peakEod: peak });
  const ddTop = Math.max(peak, size);
  const dailyRoom = (size * r.dailyLossPct) / 100;
  const pd = funded ? r.fundedProfitableDay : r.evalProfitableDay;
  const goodDays = profitableDays(pnls, size, pd.pct);
  const phaseIdx = account.phase === "phase_1" ? 0 : account.phase === "phase_2" ? 1 : -1;
  const target = phaseIdx >= 0 ? r.targetsPct[phaseIdx] : null;
  const closedProfit = account.balance - size;
  const today = istDate(now || 86_400_000 * 20_000);
  const sinceCycle = account.cycle_start_date ? daysBetween(account.cycle_start_date, today) : null;
  const payable = Math.max(0, closedProfit) * (r.payout.splitPct / 100);
  const cutoff = r.entryCutoffIST.split(":").map(Number);
  const entriesOpen = now === 0 ? true : istMinutes(now) < cutoff[0] * 60 + cutoff[1];
  const clock = `${cutoff[0] % 12 || 12}:${String(cutoff[1]).padStart(2, "0")} ${cutoff[0] >= 12 ? "PM" : "AM"}`;

  const checks: [string, boolean, string][] = funded ? [
    ["All positions closed", openCount === 0, openCount === 0 ? "Done" : `${openCount} open`],
    ["KYC verified", kyc, kyc ? "Done" : "Pending"],
    [`${r.payout.cycleDays} days in this cycle`, sinceCycle != null && sinceCycle >= r.payout.cycleDays, `${Math.max(0, sinceCycle ?? 0)} of ${r.payout.cycleDays}`],
    [`${pd.days} profitable days (+${pd.pct}%)`, goodDays >= pd.days, `${goodDays} of ${pd.days}`],
    [`Profit of ${r.payout.minProfitPct}% or more`, closedProfit >= (size * r.payout.minProfitPct) / 100, `${inr(Math.max(0, closedProfit))} of ${inr((size * r.payout.minProfitPct) / 100)}`],
    [`Reward of ${inr(r.payout.minPayoutInr)} or more`, payable >= r.payout.minPayoutInr, inr(payable)],
  ] : [];
  const ready = checks.length > 0 && checks.every((c) => c[1]);

  return (
    <div className="tr-glass tr-card">
      <h3><span>Your rules, live</span><span style={{ textTransform: "none", letterSpacing: 0 }}>v{r.version} · IST</span></h3>
      <div className="tr-meters">
        <Meter label="Daily loss" used={Math.max(0, account.day_start_equity - m.equity)} limit={dailyRoom} risk text={`${inr(Math.max(0, account.day_start_equity - m.equity))} of ${inr(dailyRoom)}`} />
        <Meter label={r.drawdownType === "trailing" ? "Drawdown · trailing" : "Drawdown"} used={Math.max(0, ddTop - m.equity)} limit={Math.max(1, ddTop - floor)} risk text={`floor ${inr(floor)}`} />
        {target != null && <Meter label={`Profit target ${target}%`} used={Math.max(0, closedProfit)} limit={(size * target) / 100} text={`${inr(Math.max(0, closedProfit))} of ${inr((size * target) / 100)}`} />}
        <Meter label={`Profitable days · +${pd.pct}% each`} used={goodDays} limit={pd.days} text={`${goodDays} of ${pd.days}`} />
        <Meter label="Open positions" used={openCount} limit={r.maxOpenPositions} risk text={`${openCount} of ${r.maxOpenPositions}`} />
      </div>
      <div className="tr-facts" style={{ marginTop: 14 }}>
        <div className="tr-ln"><span className="tr-muted">Max risk per trade</span><span className="tr-mono">{inr((account.balance * r.riskPerTradePct) / 100)}</span></div>
        <div className="tr-ln"><span className="tr-muted">New entries</span><span className={"tr-mono " + (entriesOpen ? "tr-up" : "tr-down")}>{entriesOpen ? `open until ${clock}` : `closed since ${clock}`}</span></div>
        <div className="tr-ln"><span className="tr-muted">Stop loss</span><span>on every trade</span></div>
      </div>
      {funded && (
        <div className="tr-facts" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 500, paddingBottom: 6 }}>Reward checklist {ready && <span className="tr-pill up">Ready</span>}</div>
          {checks.map(([label, done, val]) => (
            <div className="tr-ln" key={label}>
              <span><span className={done ? "tr-up" : "tr-muted"}>{done ? "✓" : "○"}</span> {label}</span>
              <span className="tr-mono tr-muted">{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
