"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import EquityChart from "@/components/trading/EquityChart";
import { dateTime, inr, nameOfKey, num, phaseLabel, statusLabel } from "@/components/trading/format";
import { accountView, compact } from "./calc";
import { usePortal } from "./PortalProvider";
import ClosureNotice from "./ClosureNotice";
import { Badge, Bar, Kpi, PageHead } from "./ui";

type Tab = "overview" | "trades" | "rules";

export default function AccountDetail({ id }: { id: string }) {
  const { accounts, plans, metrics, trades, snapshots, setSelected } = usePortal();
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => { setSelected(id); return () => setSelected(null); }, [id, setSelected]);

  const a = accounts.find((x) => x.id === id);
  if (!a) return <><PageHead title="Account not found" sub="This account doesn’t exist or isn’t yours." /><Link className="pt-btn" href="/accounts">Back to accounts</Link></>;
  const plan = plans.find((p) => p.key === a.plan_key);
  const v = accountView(a, metrics[a.id] ?? null);
  const r = v.r;
  const points = snapshots.filter((s) => s.account_id === a.id).slice().reverse().map((s) => s.equity);
  const mine = trades.filter((t) => t.account_id === a.id);
  const tgt = v.targetAmt ? Math.max(0, (v.profit / v.targetAmt) * 100) : 0;

  return (
    <>
      <Link className="pt-link" href="/accounts">‹ All accounts</Link>
      <PageHead
        title={`${compact(v.size)} · ${plan?.name ?? a.plan_key}`}
        sub={<span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>{a.is_demo && <Badge tone="warn">Demo</Badge>}<Badge tone={a.status === "active" ? "ok" : a.status === "breached" ? "bad" : "brand"}>{a.status === "active" ? phaseLabel(a.phase) : statusLabel(a.status)}</Badge></span>}
        actions={a.status === "active" ? <Link className="pt-btn primary" href={`/terminal?account=${a.id}`}>Open terminal</Link> : undefined}
      />
      {(a.status === "breached" || (a.status === "closed" && a.breach_reason)) && <ClosureNotice a={a} />}
      {a.status === "passed" && <div className="pt-banner ok"><div><b>You passed this phase.</b><p>Your next account step is being set up.</p></div></div>}

      <div className="pt-tabsbar" role="tablist">
        {([["overview", "Overview"], ["trades", "Trades"], ["rules", "Rules"]] as [Tab, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === "overview" && (
        <>
          <div className="pt-kpis">
            <Kpi label="Equity" value={inr(v.equity)} sub={`Started at ${inr(v.size)}`} />
            <Kpi label="Profit / loss" value={`${v.pl >= 0 ? "+" : ""}${inr(v.pl)}`} tone={v.pl === 0 ? undefined : v.pl > 0 ? "up" : "down"} sub={`${((v.pl / v.size) * 100).toFixed(2)}% of start`} />
            <Kpi label="Today" value={`${v.dayPl >= 0 ? "+" : ""}${inr(v.dayPl)}`} tone={v.dayPl === 0 ? undefined : v.dayPl > 0 ? "up" : "down"} />
            <Kpi label="Trading days" value={String(a.trading_days)} sub={a.cycle_no ? `Cycle ${a.cycle_no + 1}` : undefined} />
          </div>
          <div className="pt-grid2">
            <section className="pt-card">
              <div className="pt-ch"><h2>Equity</h2></div>
              <div className="pt-chart"><EquityChart points={points} base={v.size} emptyText="Your equity curve appears after your first trades." /></div>
            </section>
            <section className="pt-card">
              <div className="pt-ch"><h2>Objectives</h2></div>
              <div className="pt-stack" style={{ gap: 18 }}>
                {v.targetAmt != null && <div className="pt-prog"><div className="row"><span>Profit target {v.targetPct}%</span><b>{inr(Math.max(0, v.profit))} / {inr(v.targetAmt)}</b></div><Bar value={tgt} tone="brand" label="Profit target" /></div>}
                <div className="pt-prog"><div className="row"><span>Today’s loss limit</span><b>{inr(v.dailyUsed)} / {inr(v.dailyLimit)}</b></div><Bar value={(v.dailyUsed / v.dailyLimit) * 100} tone="risk" label="Daily loss" /></div>
                <div className="pt-prog"><div className="row"><span>Total loss limit</span><b>{inr(v.ddUsed)} / {inr(v.ddLimit)}</b></div><Bar value={(v.ddUsed / v.ddLimit) * 100} tone="risk" label="Total loss" /></div>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: ".84rem", lineHeight: 1.5 }}>Your account closes if either loss limit is crossed. Open positions count.</p>
              </div>
            </section>
          </div>
        </>
      )}

      {tab === "trades" && (
        <section className="pt-card flush">
          {mine.length === 0 ? <p className="pt-empty">No trades yet. Open the terminal to place your first one.</p> : (
            <div className="pt-scroll"><table className="pt-tbl">
              <thead><tr><th>Instrument</th><th>Side</th><th>Qty</th><th>Price</th><th>Result</th><th>Time</th></tr></thead>
              <tbody>{mine.slice(0, 60).map((t) => (
                <tr key={t.id}><td>{nameOfKey(t.instrument)}</td><td>{t.side}</td><td>{t.qty}</td><td>{num(t.price)}</td>
                  <td className={t.realized_pnl === 0 ? "" : t.realized_pnl > 0 ? "up" : "down"}>{t.realized_pnl === 0 ? "Entry" : inr(t.realized_pnl)}</td><td>{dateTime(t.executed_at)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      )}

      {tab === "rules" && (
        <section className="pt-card">
          <div className="pt-dl">
            <div><span>Max loss in a day</span><b>{r.dailyLossPct}% ({inr(v.dailyLimit)})</b></div>
            <div><span>Max total loss</span><b>{r.drawdownPct}% ({inr((v.size * r.drawdownPct) / 100)}){r.drawdownType === "trailing" ? " · trailing" : ""}</b></div>
            <div><span>Max risk per trade</span><b>{r.riskPerTradePct}% of balance</b></div>
            <div><span>Open positions at once</span><b>{r.maxOpenPositions}</b></div>
            <div><span>Minimum hold time</span><b>{r.minHoldSeconds} seconds</b></div>
            <div><span>No new trades after</span><b>{r.entryCutoffIST} IST</b></div>
            <div><span>Stop loss</span><b>1 warning, then the account closes</b></div>
            <div><span>Profit target</span><b>{r.targetsPct.length ? r.targetsPct.map((t) => `${t}%`).join(" then ") : "None, you start funded"}</b></div>
            <div><span>Your share of profit</span><b>{r.payout.splitPct}%</b></div>
            <div><span>Payouts</span><b>Every {r.payout.cycleDays} days, from {inr(r.payout.minPayoutInr)}</b></div>
          </div>
        </section>
      )}
    </>
  );
}
