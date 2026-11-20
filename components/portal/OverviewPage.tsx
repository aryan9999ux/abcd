"use client";
import { HeroArt } from "./HeroArt";
import Link from "next/link";
import { inr } from "@/components/trading/format";
import AccountCard from "./AccountCard";
import { compact } from "./calc";
import { usePortal } from "./PortalProvider";
import { Badge, Icon, Kpi, PageHead } from "./ui";

const greet = () => { const h = (new Date().getUTCHours() + 5.5) % 24; return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

export default function OverviewPage() {
  const { user, accounts, plans, metrics, rewards, kycVerified, kyc, fromPrice, trades } = usePortal();
  const real = accounts.filter((a) => !a.is_demo);
  const live = accounts.filter((a) => a.status === "active");
  const first = user.name.split(/[ .]/)[0];

  if (accounts.length === 0) {
    return (
      <>
        <PageHead title={`${greet()}, ${first}`} sub="You’re set up. Choose how you want to start." />
        <section className="pt-hero">
          <div className="pt-hero-copy"><div><Badge tone="brand">Welcome</Badge></div><h2>Trade up to ₹10L of our capital. Keep 80% of the profit.</h2>
          <p>Pass a simple test. Once you’re funded, you can request a payout every 14 days. If a trade goes wrong, you only lose your fee.</p></div>
          <HeroArt />
        </section>
        <div className="pt-paths">
          <section className="pt-path hot">
            <Badge tone="brand">Real account</Badge>
            <h3>Get funded</h3>
            <p>Pick a plan and a size. Pay one fee, with no monthly charges. Your fee comes back with your payout.</p>
            <ul><li><Icon n="check" size={16} />{fromPrice ? `From ${inr(fromPrice)}, one time` : "One-time fee"}</li><li><Icon n="check" size={16} />Payouts every 14 days</li><li><Icon n="check" size={16} />Loss limits protect you</li></ul>
            <Link className="pt-btn primary" href="/checkout">Choose an account</Link>
          </section>
          <section className="pt-path">
            <Badge>Free</Badge>
            <h3>Try a demo first</h3>
            <p>3 days on a ₹10L account with live NSE and BSE prices and the real rules of the plan you pick.</p>
            <ul><li><Icon n="check" size={16} />No payment needed</li><li><Icon n="check" size={16} />Same terminal as a real account</li><li><Icon n="check" size={16} />One demo per person</li></ul>
            <Link className="pt-btn" href="/demo">Start free demo</Link>
          </section>
        </div>
      </>
    );
  }

  const equity = live.reduce((t, a) => t + (metrics[a.id]?.equity ?? a.balance), 0);
  const dayPl = live.reduce((t, a) => t + ((metrics[a.id]?.equity ?? a.balance) - a.day_start_equity), 0);
  const paid = rewards.filter((r) => r.status === "paid").reduce((t, r) => t + r.amount_inr, 0);
  const pending = rewards.filter((r) => r.status === "requested" || r.status === "approved").reduce((t, r) => t + r.amount_inr, 0);

  const steps = [
    { t: "Get an account", d: "Demo or real", done: accounts.length > 0 },
    { t: "Place a trade", d: "In the terminal", done: trades.length > 0 || accounts.some((a) => a.trading_days > 0) },
    { t: "Pass the test", d: "Hit the profit target", done: accounts.some((a) => a.phase === "funded" || a.status === "passed") },
    { t: "Verify identity", d: "PAN and payout account", done: kycVerified },
    { t: "Get paid", d: "Request your first payout", done: rewards.length > 0 },
  ];
  const now = steps.findIndex((s) => !s.done);
  const cta = [
    null,
    live[0] ? { l: "Open terminal", h: `/terminal?account=${live[0].id}` } : { l: "Buy account", h: "/checkout" },
    live[0] ? { l: "Open terminal", h: `/terminal?account=${live[0].id}` } : { l: "Buy account", h: "/checkout" },
    { l: kyc?.status === "pending" ? "View status" : "Verify now", h: "/verification" },
    { l: "Go to payouts", h: "/payouts" },
  ][now];
  const nextText = [
    "", "Place your first trade. Start small and keep your stop loss tight.", "Reach the profit target without crossing a loss limit.",
    "You need to be verified before you can be paid. It takes 2 minutes.", "You’re funded and verified. Request your payout when you’re eligible.",
  ][now];

  return (
    <>
      <PageHead
        title={`${greet()}, ${first}`}
        sub={live.length ? `You have ${live.length} active account${live.length > 1 ? "s" : ""}.` : "None of your accounts is active right now."}
        actions={<>
          <Link className="pt-btn" href="/checkout"><Icon n="plus" size={16} /> Buy account</Link>
          {live[0] && <Link className="pt-btn primary" href={`/terminal?account=${live[0].id}`}><Icon n="terminal" size={16} /> Open terminal</Link>}
        </>}
      />

      {now !== -1 && (
        <section className="pt-card">
          <div className="pt-ch"><h2>Your path to getting paid</h2><span className="pt-badge brand">{steps.filter((s) => s.done).length} of {steps.length} done</span></div>
          <div className="pt-steps">
            {steps.map((s, i) => (
              <div key={s.t} className={"pt-step " + (s.done ? "done" : i === now ? "now" : "")}>
                <span className="n">{s.done ? "✓" : i + 1}</span><b>{s.t}</b><small>{s.d}</small>
              </div>
            ))}
          </div>
          {cta && <div className="pt-next"><p><b>Next:</b> {nextText}</p><Link className="pt-btn primary sm" href={cta.h}>{cta.l}</Link></div>}
        </section>
      )}

      <div className="pt-kpis">
        <Kpi label="Total equity" value={inr(equity)} sub={`${live.length} active`} />
        <Kpi label="Today’s P&L" value={`${dayPl >= 0 ? "+" : ""}${inr(dayPl)}`} tone={dayPl === 0 ? undefined : dayPl > 0 ? "up" : "down"} sub="Across active accounts" />
        <Kpi label="Rewards paid" value={inr(paid)} sub={pending ? `${inr(pending)} pending` : "No pending requests"} />
        <Kpi label="Verification" value={kycVerified ? "Verified" : kyc?.status === "pending" ? "In review" : "Not done"} tone={kycVerified ? "up" : undefined} sub={kycVerified ? "You can request payouts" : "Needed before payouts"} />
      </div>

      <div className="pt-ch pt-sec"><h2>Your accounts</h2><Link className="pt-link" href="/accounts">See all</Link></div>
      <div className="pt-grid2">
        <section className="pt-stack">
          {accounts.slice().reverse().slice(0, 3).map((a) => <AccountCard key={a.id} a={a} plan={plans.find((p) => p.key === a.plan_key)} m={metrics[a.id] ?? null} />)}
        </section>
        <aside className="pt-stack">
          <section className="pt-card flush">
            <div className="pt-ch"><h2>Rewards</h2><Link className="pt-link" href="/payouts">Open</Link></div>
            {rewards.length === 0 ? <p className="pt-empty">No payouts yet. Once an account is funded, you can request one every 14 days.</p> : (
              <div className="pt-list">
                {rewards.slice(0, 4).map((r) => (
                  <div key={r.id} className="pt-li"><span><b>{inr(r.amount_inr)}</b><small>{new Date(r.requested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small></span><Badge tone={r.status === "paid" ? "ok" : r.status === "rejected" ? "bad" : "warn"}>{r.status === "requested" ? "In review" : r.status}</Badge></div>
                ))}
              </div>
            )}
          </section>
          {!kycVerified && (
            <section className="pt-card">
              <div className="pt-ch"><h2>Verify your identity</h2></div>
              <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: ".92rem", lineHeight: 1.5 }}>{kyc?.status === "pending" ? "We’re reviewing your details. This usually takes a day." : kyc?.status === "rejected" ? "We couldn’t verify your details. Please check and send them again." : "Add your PAN and payout account so we can pay you when you’re funded."}</p>
              <Link className="pt-btn primary sm" href="/verification">{kyc?.status === "pending" ? "View status" : "Verify now"}</Link>
            </section>
          )}
          {real.length === 0 && (
            <section className="pt-card">
              <div className="pt-ch"><h2>Ready for a real account?</h2></div>
              <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: ".92rem", lineHeight: 1.5 }}>Plans start {fromPrice ? `at ${inr(fromPrice)}` : "with a small one-time fee"}. Accounts go up to {compact(1_000_000)}.</p>
              <Link className="pt-btn sm" href="/checkout">See plans</Link>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
