"use client";
import Link from "next/link";
import AccountCard from "./AccountCard";
import { usePortal } from "./PortalProvider";
import { Icon, PageHead } from "./ui";

export default function AccountsPage() {
  const { accounts, plans, metrics } = usePortal();
  const ordered = accounts.slice().reverse();
  const active = ordered.filter((a) => a.status === "active");
  const rest = ordered.filter((a) => a.status !== "active");
  return (
    <>
      <PageHead title="Accounts" sub="Every account you have, with how close each one is to its target and its loss limits." actions={<Link className="pt-btn primary" href="/checkout"><Icon n="plus" size={16} /> Buy account</Link>} />
      {accounts.length === 0 && (
        <section className="pt-card"><p className="pt-empty">You don’t have an account yet. Start a free 3-day demo, or buy a real account.</p><div style={{ display: "flex", gap: 10, justifyContent: "center", paddingBottom: 12 }}><Link className="pt-btn" href="/demo">Start free demo</Link><Link className="pt-btn primary" href="/checkout">Buy account</Link></div></section>
      )}
      {active.length > 0 && <div className="pt-ch" style={{ marginBottom: -6 }}><h2>Active</h2></div>}
      <div className="pt-cols">{active.map((a) => <AccountCard key={a.id} a={a} plan={plans.find((p) => p.key === a.plan_key)} m={metrics[a.id] ?? null} />)}</div>
      {rest.length > 0 && <div className="pt-ch" style={{ marginBottom: -6 }}><h2>Past accounts</h2></div>}
      <div className="pt-cols">{rest.map((a) => <AccountCard key={a.id} a={a} plan={plans.find((p) => p.key === a.plan_key)} m={metrics[a.id] ?? null} />)}</div>
    </>
  );
}
