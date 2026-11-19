"use client";
import { Spin } from "@/components/ui/Spin";
import "./checkout.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Plan } from "./types";
import PlanPicker from "./PlanPicker";
import { planFacts } from "./planFacts";

export default function DemoForm({ plans, initialPlan, existing }: { plans: Plan[]; initialPlan?: string; existing: { id: string; demo_expires_at: string | null; status: string } | null }) {
  const router = useRouter();
  const [planKey, setPlanKey] = useState(plans.find((p) => p.key === initialPlan)?.key ?? plans[1]?.key ?? plans[0]?.key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = plans.find((p) => p.key === planKey);
  if (!plan) return <p className="cx-note">Plans are not available right now. Please check back soon.</p>;

  if (existing) {
    const over = existing.status !== "active" || (existing.demo_expires_at != null && Date.parse(existing.demo_expires_at) <= Date.now());
    return (
      <div className="cx-demo" style={{ marginTop: 30 }}>
        <div><b>{over ? "Your free demo has ended." : "You already have a demo running."}</b><span>{over ? "Buy an account to keep trading and earn payouts." : "Open your dashboard to keep trading."}</span></div>
        <Link className="btn primary" href={over ? "/checkout" : `/dashboard?account=${existing.id}`}>{over ? "Choose an account" : "Open dashboard"}</Link>
      </div>
    );
  }

  async function start() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planKey: plan!.key }) });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; accountId?: string } | null;
      if (!res.ok || !json?.ok) { setError(json?.error ?? "Could not start your demo. Please try again."); return; }
      router.push(`/dashboard?account=${json.accountId}`);
      router.refresh();
    } catch { setError("Could not reach the server. Check your connection and try again."); } finally { setBusy(false); }
  }

  return (
    <div className="cx-grid">
      <div>
        <section className="cx-sec"><h2>Which plan do you want to try?</h2><PlanPicker plans={plans} value={plan.key} onChange={setPlanKey} /></section>
        <section className="cx-sec"><h2>The rules you will trade with</h2>
          <div className="cxf">{planFacts(plan, 1000000).filter((f) => !["Account size", "Payouts", "Your fee"].includes(f.k)).map((f) => (<div key={f.k}><span>{f.k}</span><b>{f.v}</b></div>))}</div>
        </section>
      </div>
      <aside className="cx-sum" aria-label="Your demo">
        <h3>Your free demo</h3>
        <ul className="cx-list">
          <li>₹10L practice account</li>
          <li>Live NSE and BSE prices</li>
          <li>The same rules as the real {plan.name} plan</li>
          <li>Lasts 3 days</li>
        </ul>
        <p className="cx-note">Demo accounts do not earn payouts. You get one demo per person. No card needed.</p>
        {error && <p className="cx-err" role="alert">{error}</p>}
        <button className="btn primary" type="button" onClick={start} disabled={busy}>{busy ? <><Spin />Starting…</> : "Start free demo"}</button>
        <Link className="cx-note" href={`/checkout?plan=${plan.key}`}>Or buy a real account</Link>
      </aside>
    </div>
  );
}
