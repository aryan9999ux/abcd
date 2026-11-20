"use client";
import { Spin } from "@/components/ui/Spin";
import "./checkout.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiResult, CheckoutRequest, CheckoutResponse } from "@/lib/types";
import type { Plan, PlanPrice } from "./types";
import { inr, sizeLabel } from "./format";
import PlanPicker from "./PlanPicker";
import { planFacts } from "./planFacts";
import PayPanel, { type PaySettings } from "./PayPanel";

export default function CheckoutForm({
  plans, prices, initialPlan, initialSize, email, testMode, demoAvailable, pay,
}: {
  plans: Plan[]; prices: PlanPrice[]; initialPlan?: string; initialSize?: number; email?: string; testMode: boolean; demoAvailable: boolean; pay: PaySettings;
}) {
  const router = useRouter();
  const [planKey, setPlanKey] = useState(plans.find((p) => p.key === initialPlan)?.key ?? plans[0]?.key);
  const [size, setSize] = useState<number | undefined>(initialSize);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const plan = plans.find((p) => p.key === planKey);
  const list = prices.filter((x) => x.plan_key === planKey).sort((a, b) => a.account_size - b.account_size);
  const active = list.find((x) => x.account_size === size) ?? list[0];

  if (!plan || !active) return <p className="cx-note">Plans are not available right now. Please check back soon.</p>;

  // Display only. The server looks the price up again from the database.
  const total = active.price_inr;
  const base = Math.round(total / 1.18);

  function openPay() {
    if (!agree) return setError("Please tick the box to confirm you have read this.");
    setError(null);
    setPaying(true);
  }

  async function testBuy() {
    if (!agree) return setError("Please tick the box to confirm you have read this.");
    setError(null);
    setBusy(true);
    try {
      // Payment seam: when a gateway is connected, create the order and take payment here, then call this.
      const body: CheckoutRequest = { planKey: plan!.key, accountSize: active!.account_size };
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => null)) as ApiResult<CheckoutResponse> | null;
      if (!res.ok || !json || !json.ok) {
        setError(json && !json.ok ? json.error : "Checkout failed. Please try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cx-grid">
      <div>
        <section className="cx-sec">
          <h2>1. Choose a plan</h2>
          <PlanPicker plans={plans} value={plan.key} onChange={(k) => { setPlanKey(k); setSize(undefined); }} />
        </section>
        <section className="cx-sec">
          <h2>2. Choose an account size</h2>
          <div className="sizes" role="group" aria-label="Account size">
            {list.map((x) => (
              <button key={x.account_size} type="button" aria-pressed={x.account_size === active.account_size} onClick={() => setSize(x.account_size)}>{sizeLabel(x.account_size)}</button>
            ))}
          </div>
        </section>
        <section className="cx-sec">
          <h2>What you get</h2>
          <div className="cxf">
            {planFacts(plan, active.account_size).map((f) => (<div key={f.k}><span>{f.k}</span><b>{f.v}</b></div>))}
          </div>
        </section>
        {demoAvailable && (
          <div className="cx-demo">
            <div><b>Not sure yet? Try it free for 3 days.</b><span>A {sizeLabel(1000000)} practice account with the same rules.</span></div>
            <Link className="btn" href={`/demo?plan=${plan.key}`}>Start free demo</Link>
          </div>
        )}
      </div>
      <aside className="cx-sum" aria-label="Order summary">
        <h3>Your order</h3>
        <div className="cx-ln"><span>{plan.name}, {sizeLabel(active.account_size)}</span><b>{inr(base)}</b></div>
        <div className="cx-ln"><span>GST (18%)</span><b>{inr(total - base)}</b></div>
        <div className="cx-tot"><span>Total</span><b>{inr(total)}</b></div>
        <ul className="cx-list">
          <li>Your account opens within minutes of payment approval</li>
          <li>You keep {plan.reward_split_pct}% of the profit</li>
          <li>One fee. No monthly charges.</li>
        </ul>
        <label className="cx-chk" htmlFor="co-agree">
          <input id="co-agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I have read and accept the <Link href="/terms" target="_blank">Terms</Link>, <Link href="/risk" target="_blank">Risk Disclosure</Link> and <Link href="/refund" target="_blank">Refund Policy</Link>. I understand the fee is not an investment and is not refundable on request.</span>
        </label>
        {error && <p className="cx-err" role="alert">{error}</p>}
        <button className="btn primary" type="button" onClick={openPay}>{`Pay ${inr(total)} by UPI`}</button>
        {email && <p className="cx-note">Account for {email}</p>}
        {testMode && <p className="cx-note"><button type="button" className="cx-link" onClick={testBuy} disabled={busy}>{busy ? <><Spin />Opening…</> : "Test mode: open account without paying"}</button></p>}
      </aside>
      {paying && <PayPanel pay={pay} amount={total} planKey={plan.key} size={active.account_size} label={`${plan.name}, ${sizeLabel(active.account_size)}`} onClose={() => setPaying(false)} />}
    </div>
  );
}
