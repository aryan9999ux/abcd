"use client";
import { Spin } from "@/components/ui/Spin";
import Link from "next/link";
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { daysBetween, istDate, profitableDays } from "@/lib/engine/pure";
import { postJSON } from "@/components/trading/api";
import { inr } from "@/components/trading/format";
import type { AccountRow } from "@/components/trading/types";
import { compact, rulesOf } from "./calc";
import { usePortal } from "./PortalProvider";
import { Badge, Icon, Kpi, PageHead } from "./ui";

function Eligibility({ a }: { a: AccountRow }) {
  const { positions, kycVerified, rewards, refresh, plans } = usePortal();
  const [pnls, setPnls] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; err: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    void browserClient().from("day_results").select("pnl").eq("account_id", a.id).eq("cycle_no", a.cycle_no ?? 0).then((r) => { if (live) setPnls((r.data ?? []).map((x: { pnl: unknown }) => Number(x.pnl))); });
    return () => { live = false; };
  }, [a.id, a.cycle_no, a.balance]);

  const r = rulesOf(a);
  const size = a.account_size;
  const profit = a.balance - size;
  const payable = Math.max(0, profit) * (r.payout.splitPct / 100);
  const open = positions.filter((p) => p.account_id === a.id).length;
  const since = a.cycle_start_date ? daysBetween(a.cycle_start_date, istDate(Date.now())) : 0;
  const good = pnls ? profitableDays(pnls, size, r.fundedProfitableDay.pct) : 0;
  const review = rewards.some((x) => x.account_id === a.id && x.status === "requested");
  const minProfit = (size * r.payout.minProfitPct) / 100;
  const checks: [string, boolean, string][] = [
    ["Identity verified", kycVerified, kycVerified ? "Done" : "Pending"],
    [`${r.payout.cycleDays} days since your cycle started`, since >= r.payout.cycleDays, `${Math.max(0, since)} of ${r.payout.cycleDays}`],
    [`${r.fundedProfitableDay.days} profitable days (+${r.fundedProfitableDay.pct}% each)`, good >= r.fundedProfitableDay.days, `${good} of ${r.fundedProfitableDay.days}`],
    [`Profit of ${r.payout.minProfitPct}% or more`, profit >= minProfit, `${inr(Math.max(0, profit))} of ${inr(minProfit)}`],
    [`Payout of ${inr(r.payout.minPayoutInr)} or more`, payable >= r.payout.minPayoutInr, inr(payable)],
    ["All positions closed", open === 0, open === 0 ? "Done" : `${open} open`],
  ];
  const ready = checks.every((c) => c[1]) && !review;
  const plan = plans.find((p) => p.key === a.plan_key);

  async function request() {
    setBusy(true); setMsg(null);
    const res = await postJSON("/api/rewards/request", { accountId: a.id });
    setBusy(false);
    if (res.ok) { setMsg({ t: "Request sent. We review it within a day, and trading on this account pauses until it’s decided.", err: false }); refresh(); }
    else setMsg({ t: res.error, err: true });
  }

  return (
    <section className="pt-card">
      <div className="pt-ch"><h2>{compact(size)} · {plan?.name ?? a.plan_key}</h2>{review ? <Badge tone="warn">Request in review</Badge> : ready ? <Badge tone="ok">Eligible</Badge> : <Badge>Not yet</Badge>}</div>
      <div className="pt-check">
        {checks.map(([l, ok, v]) => <div key={l}><span><span className={ok ? "ok" : "no"}>{ok ? "✓" : "○"}</span> {l}</span><em>{v}</em></div>)}
      </div>
      <div className="pt-next">
        <p>You would receive <b>{inr(payable)}</b> ({r.payout.splitPct}% of your profit).</p>
        <button className="pt-btn primary" disabled={!ready || busy} onClick={request}>{busy ? <><Spin />Sending…</> : "Request payout"}</button>
      </div>
      {msg && <p className={"pt-msg " + (msg.err ? "err" : "ok")} role="status" style={{ marginTop: 12 }}>{msg.t}</p>}
    </section>
  );
}

export default function PayoutsPage() {
  const { accounts, rewards, kycVerified, plans } = usePortal();
  const funded = accounts.filter((a) => a.phase === "funded" && a.status === "active" && !a.is_demo);
  const paid = rewards.filter((r) => r.status === "paid").reduce((t, r) => t + r.amount_inr, 0);
  const pending = rewards.filter((r) => r.status === "requested" || r.status === "approved").reduce((t, r) => t + r.amount_inr, 0);
  const label = (s: string) => (s === "requested" ? "In review" : s === "approved" ? "Approved" : s === "paid" ? "Paid" : "Rejected");
  const accName = (id: string) => { const a = accounts.find((x) => x.id === id); return a ? `${compact(a.account_size)} · ${plans.find((p) => p.key === a.plan_key)?.name ?? a.plan_key}` : "Account"; };

  return (
    <>
      <PageHead title="Payouts" sub="Once an account is funded, you can request a payout every 14 days. You keep 80% of your profit." />
      <div className="pt-kpis">
        <Kpi label="Total paid" value={inr(paid)} />
        <Kpi label="Pending" value={inr(pending)} sub="In review or approved" />
        <Kpi label="Funded accounts" value={String(funded.length)} />
        <Kpi label="Verification" value={kycVerified ? "Verified" : "Needed"} tone={kycVerified ? "up" : undefined} sub={kycVerified ? "You’re set" : "Required for payouts"} />
      </div>
      {!kycVerified && (
        <div className="pt-banner warn"><div><b>Verify your identity to get paid</b><p>We need your PAN and payout account before we can send money.</p></div><Link className="pt-btn primary sm" href="/verification">Verify now</Link></div>
      )}

      {funded.length === 0 ? (
        <section className="pt-card">
          <div className="pt-ch"><h2>How you get paid</h2></div>
          <div className="pt-check">
            <div><span><span className="no">1</span> Pass the evaluation and your account becomes funded</span></div>
            <div><span><span className="no">2</span> Trade for 14 days and stay inside the loss limits</span></div>
            <div><span><span className="no">3</span> Request a payout here. We review it within a day</span></div>
            <div><span><span className="no">4</span> You receive 80% of your profit in your bank or UPI</span></div>
          </div>
          <div className="pt-next"><p>No funded account yet. Your accounts and progress are on the Accounts page.</p><Link className="pt-btn sm" href="/accounts"><Icon n="accounts" size={16} /> Accounts</Link></div>
        </section>
      ) : funded.map((a) => <Eligibility key={a.id} a={a} />)}

      <section className="pt-card flush">
        <div className="pt-ch"><h2>History</h2></div>
        {rewards.length === 0 ? <p className="pt-empty">Your payout requests will show up here.</p> : (
          <div className="pt-scroll"><table className="pt-tbl">
            <thead><tr><th>Requested</th><th>Account</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
            <tbody>{rewards.map((r) => (
              <tr key={r.id}><td>{new Date(r.requested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td><td>{accName(r.account_id)}</td><td>{inr(r.amount_inr)}</td>
                <td><Badge tone={r.status === "paid" ? "ok" : r.status === "rejected" ? "bad" : "warn"}>{label(r.status)}</Badge>{r.status === "rejected" && r.reject_reason && <div style={{ color: "var(--muted)", fontSize: ".8rem", marginTop: 4, whiteSpace: "normal", maxWidth: 240 }}>{r.reject_reason}</div>}</td><td>{r.payout_ref ?? "—"}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
