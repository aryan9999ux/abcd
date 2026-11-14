"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SYMBOLS } from "./constants";
import EquityChart from "./EquityChart";
import { dateTime, inr, nameOfKey, num, pct, phaseLabel, statusLabel } from "./format";
import { accountMetrics } from "./metrics";
import NoAccounts from "./NoAccounts";
import RewardCard from "./RewardCard";
import RulesPanel from "./RulesPanel";
import Shell from "./Shell";
import type { AccountRow, PlanRow } from "./types";
import { useQuotes } from "./useQuotes";
import { useTraderData } from "./useTraderData";

interface Props {
  initialAccounts: AccountRow[];
  plans: PlanRow[];
  initialAccountId: string | null;
}

export default function DashboardClient({ initialAccounts, plans, initialAccountId }: Props) {
  const [accountId, setAccountId] = useState<string | null>(initialAccountId);
  const data = useTraderData(initialAccounts, accountId);
  const { quotes: spots, error: quoteError } = useQuotes(SYMBOLS);

  const planOf = (a: AccountRow) => plans.find((p) => p.key === a.plan_key);
  const metricsById = useMemo(() => {
    const out = new Map<string, ReturnType<typeof accountMetrics>>();
    for (const a of data.accounts) {
      out.set(a.id, accountMetrics(a, plans.find((p) => p.key === a.plan_key), data.positions.filter((p) => p.account_id === a.id), spots));
    }
    return out;
  }, [data.accounts, data.positions, plans, spots]);

  if (data.accounts.length === 0) {
    return <Shell active="dashboard"><NoAccounts what="dashboard" /></Shell>;
  }

  const account = data.accounts.find((a) => a.id === accountId) ?? data.accounts[data.accounts.length - 1];
  const plan = planOf(account);
  const m = metricsById.get(account.id)!;
  const curve = [...data.snapshots.filter((s) => s.account_id === account.id).map((s) => s.equity), ...(m.pricesReady ? [m.equity] : [])];
  const split = plan?.reward_split_pct ?? 80;
  const openCount = data.positions.filter((p) => p.account_id === account.id).length;

  const slot = (
    <label className="tr-f tr-acctsel">
      Account
      <select value={account.id} onChange={(e) => setAccountId(e.target.value)} aria-label="Trading account">
        {data.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {planOf(a)?.name ?? a.plan_key} · {inr(a.account_size)} · {phaseLabel(a.phase)}{a.status !== "active" ? ` · ${statusLabel(a.status)}` : ""}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Shell active="dashboard" accountId={account.id} slot={slot}>
      <div className="tr-dhead">
        <div>
          <span className="tr-eyebrow">Account overview</span>
          <h1>{plan?.name ?? "Account"} · {inr(account.account_size)}</h1>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="tr-btn" href="/checkout">Buy new account</Link>
          <Link className="tr-btn primary" href={`/terminal?account=${account.id}`}>Open terminal</Link>
        </div>
      </div>

      {account.status === "breached" && (
        <div className="tr-banner bad" role="alert"><b>Account closed.</b> {account.breach_reason ?? "A loss limit was reached."} Open positions were squared off.</div>
      )}
      {account.status === "passed" && <div className="tr-banner ok"><b>Phase passed.</b> This account no longer accepts new orders.</div>}
      {(quoteError || data.error) && <div className="tr-banner" role="status">{quoteError ?? data.error}</div>}
      {!m.pricesReady && openCount > 0 && <div className="tr-banner" role="status">Waiting for prices. Open P&amp;L shows as soon as they arrive.</div>}

      <div className="tr-hero">
        <div className="tr-glass tr-equity">
          <small>Equity</small>
          <div className="n">{m.pricesReady || openCount === 0 ? inr(m.equity) : inr(account.balance)}</div>
          <div className="row">
            <span>Profit / loss <b className={m.pl >= 0 ? "tr-up" : "tr-down"}>{inr(m.pl)} {pct(m.plPct)}</b></span>
            <span>Open P&amp;L <b>{inr(m.unrealized)}</b></span>
            <span>Balance <b>{inr(account.balance)}</b></span>
          </div>
          <EquityChart points={curve} base={account.account_size} emptyText={data.loading ? "Loading your equity history…" : "Your equity curve appears after your first trades."} />
          <div className="row" style={{ marginTop: 6 }}>
            <span className="tr-pill gold">{phaseLabel(account.phase)}</span>
            <span className={"tr-pill " + (account.status === "active" ? "up" : "down")}>{statusLabel(account.status)}</span>
            {account.phase === "funded" && <span>Reward at {split}% <b className="tr-up">{inr(m.rewardEstimate)}</b></span>}
          </div>
        </div>
        {account.status === "active" ? <RulesPanel account={account} m={m} openCount={openCount} /> : <div className="tr-glass tr-card"><h3>Rules</h3><p className="tr-muted">This account is not active.</p></div>}
      </div>

      {account.phase === "funded" && account.status === "active" && <RewardCard accountId={account.id} onDone={data.refetch} />}

      <div className="tr-dcols">
        <div className="tr-stack">
          <div className="tr-glass tr-card">
            <h3>Recent trades</h3>
            <div className="tr-scroll">
              <table>
                <thead><tr><th className="l">Time</th><th className="l">Instrument</th><th>Side</th><th>Qty</th><th>Price</th><th>Realised P&amp;L</th></tr></thead>
                <tbody>
                  {data.loading && <tr><td colSpan={6} className="tr-empty">Loading trades…</td></tr>}
                  {!data.loading && !data.trades.length && <tr><td colSpan={6} className="tr-empty">No trades on this account yet. Open the terminal to place your first one.</td></tr>}
                  {data.trades.slice(0, 15).map((t) => (
                    <tr key={t.id}>
                      <td className="l tr-mono">{dateTime(t.executed_at)}</td>
                      <td className="l">{nameOfKey(t.instrument)}</td>
                      <td>{t.side}</td>
                      <td className="tr-mono">{t.qty}</td>
                      <td className="tr-mono">{num(t.price)}</td>
                      <td className={"tr-mono " + (t.realized_pnl >= 0 ? "tr-up" : "tr-down")}>{t.realized_pnl === 0 ? "—" : inr(t.realized_pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="tr-stack">
          {[...data.accounts].reverse().map((a) => {
            const am = metricsById.get(a.id)!;
            const ap = planOf(a);
            const current = a.id === account.id;
            return (
              <div className="tr-glass tr-acct" key={a.id} aria-current={current}>
                <div className="top">
                  <div>
                    <b>{ap?.name ?? a.plan_key}</b> <span className="tr-pill">{phaseLabel(a.phase)}</span>{" "}
                    <span className={"tr-pill " + (a.status === "active" ? "up" : a.status === "breached" ? "down" : "")}>{statusLabel(a.status)}</span>
                  </div>
                  <button className="tr-btn sm" onClick={() => setAccountId(a.id)} disabled={current}>{current ? "Selected" : "Select"}</button>
                </div>
                <div className="tr-muted" style={{ fontSize: ".78rem" }}>{inr(a.account_size)} · opened {dateTime(a.created_at)} · equity <span className="tr-mono">{inr(am.equity)}</span></div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="tr-hint" style={{ marginTop: 14 }}>Simulated trading accounts. Rewards follow the Terms and are not guaranteed. Most participants do not earn rewards.</p>
    </Shell>
  );
}
