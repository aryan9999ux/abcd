"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import "./dashboard.css";
import { drawdownFloor } from "@/lib/engine/pure";
import { PLAN_RULES } from "@/lib/rules";
import { SYMBOLS } from "./constants";
import { Meter } from "./Meter";
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
  fromPrice?: number | null;
}

export default function DashboardClient({ initialAccounts, plans, initialAccountId, fromPrice }: Props) {
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); }, []);
  const [accountId, setAccountId] = useState<string | null>(initialAccountId);
  const data = useTraderData(initialAccounts, accountId);
  const heldKeys = useMemo(
    () => [...new Set(data.positions.filter((p) => !p.instrument.includes("|EQ|")).map((p) => p.instrument))].slice(0, 40),
    [data.positions],
  );
  const { quotes: spots, error: quoteError } = useQuotes(SYMBOLS, heldKeys);

  const planOf = (a: AccountRow) => plans.find((p) => p.key === a.plan_key);
  const metricsById = useMemo(() => {
    const out = new Map<string, ReturnType<typeof accountMetrics>>();
    for (const a of data.accounts) {
      out.set(a.id, accountMetrics(a, plans.find((p) => p.key === a.plan_key), data.positions.filter((p) => p.account_id === a.id), spots));
    }
    return out;
  }, [data.accounts, data.positions, plans, spots]);

  if (data.accounts.length === 0) {
    return <Shell active="dashboard"><NoAccounts what="dashboard" fromPrice={fromPrice} /></Shell>;
  }

  const account = data.accounts.find((a) => a.id === accountId) ?? data.accounts[data.accounts.length - 1];
  const plan = planOf(account);
  const m = metricsById.get(account.id)!;
  const curve = [...data.snapshots.filter((s) => s.account_id === account.id).map((s) => s.equity), ...(m.pricesReady ? [m.equity] : [])];
  const split = plan?.reward_split_pct ?? 80;
  const openCount = data.positions.filter((p) => p.account_id === account.id).length;
  const rules = account.rules ?? PLAN_RULES[account.plan_key];
  const size = account.account_size;
  const equity = m.pricesReady || openCount === 0 ? m.equity : account.balance;
  const phaseIdx = account.phase === "phase_1" ? 0 : account.phase === "phase_2" ? 1 : -1;
  const target = rules && phaseIdx >= 0 ? rules.targetsPct[phaseIdx] : null;
  const closedProfit = account.balance - size;
  const peak = Number(account.peak_eod_balance ?? size);
  const floor = rules ? drawdownFloor({ accountSize: size, drawdownPct: rules.drawdownPct, drawdownType: rules.drawdownType, peakEod: peak }) : size * 0.92;
  const ddTop = Math.max(peak, size);
  const dailyRoom = rules ? (size * rules.dailyLossPct) / 100 : (size * 4) / 100;
  const active = account.status === "active";
  const demoLeft = account.is_demo && account.demo_expires_at && now ? Math.max(0, Math.ceil((Date.parse(account.demo_expires_at) - now) / 86_400_000)) : null;
  const demoOver = account.is_demo && now > 0 && account.demo_expires_at != null && Date.parse(account.demo_expires_at) <= now;

  const next = !active ? null
    : target != null ? <>Make <b>{target}%</b> profit to pass this {phaseLabel(account.phase).toLowerCase()}. You are at <b>{pct(Math.max(0, (closedProfit / size) * 100), 1)}</b>.</>
    : <>You are funded. Trade inside your limits{account.is_demo ? ". Demo accounts do not earn rewards." : ", and ask for a reward when the checklist below is complete."}</>;

  return (
    <Shell active="dashboard" accountId={account.id}>
      <div className="db">
        <div>
          <h1>Your accounts</h1>
          <p className="db-sub">Pick an account to see how it is doing.</p>
        </div>

        <div className="db-accts" role="list">
          {[...data.accounts].reverse().map((a) => {
            const am = metricsById.get(a.id)!;
            const current = a.id === account.id;
            return (
              <button key={a.id} role="listitem" className="db-acct" aria-current={current} onClick={() => setAccountId(a.id)}>
                <span className="t"><span>{planOf(a)?.name ?? a.plan_key}</span>{a.is_demo ? <span className="db-chip demo">Demo</span> : <span className={"db-chip " + (a.status === "active" ? "up" : a.status === "breached" ? "down" : "")}>{statusLabel(a.status)}</span>}</span>
                <span className="s">{inr(a.account_size)}</span>
                <span className="m"><span>{phaseLabel(a.phase)}</span><span>Equity {inr(am.equity)}</span></span>
              </button>
            );
          })}
          <Link className="db-add" href="/checkout"><b>+</b>New account</Link>
        </div>

        {account.is_demo && !demoOver && (
          <div className="db-note demo">
            <span><b>Free demo.</b> {demoLeft != null ? `${demoLeft} day${demoLeft === 1 ? "" : "s"} left.` : ""} Same rules as a real {plan?.name} account, but no rewards.</span>
            <Link className="tr-btn primary sm" href={`/checkout?plan=${account.plan_key}`}>Buy a real account</Link>
          </div>
        )}
        {demoOver && (
          <div className="db-note bad" role="alert"><span><b>Your demo has ended.</b> Buy an account to keep trading and earn rewards.</span><Link className="tr-btn primary sm" href={`/checkout?plan=${account.plan_key}`}>Choose an account</Link></div>
        )}
        {account.status === "breached" && (
          <div className="db-note bad" role="alert"><span><b>Account closed.</b> {account.breach_reason ?? "A loss limit was reached."} Open positions were closed.</span><Link className="tr-btn sm" href="/checkout">Start a new account</Link></div>
        )}
        {account.status === "passed" && <div className="db-note ok"><span><b>Phase passed.</b> This account no longer accepts new orders.</span></div>}
        {(quoteError || data.error) && !demoOver && <div className="db-note" role="status"><span>{quoteError ?? data.error}</span></div>}

        <div className="db-grid">
          <section className="db-card db-eq" aria-label="Overview">
            <small>Account value</small>
            <div className="n">{inr(equity)}</div>
            <div className="pl"><span className={m.pl >= 0 ? "tr-up" : "tr-down"}>{inr(m.pl)} ({pct(m.plPct)})</span> <span className="tr-muted" style={{ fontWeight: 500 }}>since the start</span></div>
            <EquityChart points={curve} base={size} emptyText={data.loading ? "Loading your history…" : "Your chart appears after your first trades."} />
            <div className="db-stats">
              <div><small>Cash balance</small><b>{inr(account.balance)}</b></div>
              <div><small>Open trades P&amp;L</small><b className={m.unrealized >= 0 ? "" : "tr-down"}>{openCount === 0 ? "None open" : inr(m.unrealized)}</b></div>
              <div><small>Days traded</small><b>{account.trading_days}</b></div>
            </div>
            <div className="db-act">
              <Link className="tr-btn primary" href={`/terminal?account=${account.id}`} aria-disabled={!active}>Open terminal</Link>
              {account.phase === "funded" && active && !account.is_demo && <a className="tr-btn" href="#reward">Reward</a>}
            </div>
          </section>

          <section className="db-card" aria-label="Your limits">
            <h2>Your progress</h2>
            {next && <div className="db-next">{next}</div>}
            {active ? (
              <div className="db-meters">
                {target != null && <Meter label="Profit goal" used={Math.max(0, closedProfit)} limit={(size * target) / 100} text={`${inr(Math.max(0, closedProfit))} of ${inr((size * target) / 100)}`} />}
                <Meter label="Today’s loss limit" used={Math.max(0, account.day_start_equity - equity)} limit={dailyRoom} risk text={`${inr(Math.max(0, account.day_start_equity - equity))} of ${inr(dailyRoom)}`} />
                <Meter label="Total loss limit" used={Math.max(0, ddTop - equity)} limit={Math.max(1, ddTop - floor)} risk text={`${inr(Math.max(0, ddTop - equity))} of ${inr(Math.max(1, ddTop - floor))}`} />
              </div>
            ) : <p className="tr-muted">This account is not active.</p>}
            {active && (
              <details className="db-more">
                <summary>See all rules{account.phase === "funded" && !account.is_demo ? " and reward checklist" : ""}</summary>
                <RulesPanel account={account} m={m} openCount={openCount} />
              </details>
            )}
          </section>
        </div>

        {account.phase === "funded" && active && !account.is_demo && <div id="reward"><RewardCard accountId={account.id} onDone={data.refetch} /></div>}

        <section className="db-card db-trades" aria-label="Recent trades">
          <h2>Recent trades</h2>
          <div className="tr-scroll">
            <table>
              <thead><tr><th className="l">Time</th><th className="l">Instrument</th><th>Side</th><th>Qty</th><th>Price</th><th>Profit / loss</th></tr></thead>
              <tbody>
                {data.loading && <tr><td colSpan={6} className="tr-empty">Loading trades…</td></tr>}
                {!data.loading && !data.trades.length && <tr><td colSpan={6} className="tr-empty">No trades yet. Open the terminal to place your first one.</td></tr>}
                {data.trades.slice(0, 10).map((t) => (
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
        </section>
        <p className="db-foot">Simulated trading accounts. Rewards follow the Terms and are not guaranteed. Most participants do not earn rewards.</p>
      </div>
    </Shell>
  );
}
