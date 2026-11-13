"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiResult, CheckoutRequest, CheckoutResponse } from "@/lib/types";
import type { Plan, PlanPrice } from "./types";
import { inr, sizeLabel } from "./format";

export default function CheckoutForm({
  plans, prices, initialPlan, initialSize, email,
}: {
  plans: Plan[]; prices: PlanPrice[]; initialPlan?: string; initialSize?: number; email?: string;
}) {
  const router = useRouter();
  const [planKey, setPlanKey] = useState(plans.find((p) => p.key === initialPlan)?.key ?? plans[0]?.key);
  const [size, setSize] = useState<number | undefined>(initialSize);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = plans.find((p) => p.key === planKey);
  const list = prices.filter((x) => x.plan_key === planKey).sort((a, b) => a.account_size - b.account_size);
  const active = list.find((x) => x.account_size === size) ?? list[0];

  if (!plan || !active) return <p className="muted">Plans are not available right now. Please check back soon.</p>;

  // Display only. The server looks the price up again from the database.
  const total = active.price_inr;
  const base = Math.round(total / 1.18);

  async function pay() {
    if (!agree) return setError("Please confirm you understand the account is simulated.");
    setError(null);
    setBusy(true);
    try {
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
    <div className="co">
      <div className="glass card">
        <div>
          <small className="muted">Plan</small>
          <div className="seg" style={{ marginTop: 6 }}>
            {plans.map((p) => (
              <button key={p.key} type="button" aria-pressed={p.key === plan.key} onClick={() => setPlanKey(p.key)}>{p.name}</button>
            ))}
          </div>
        </div>
        <div>
          <small className="muted">Account size</small>
          <div className="seg" style={{ marginTop: 6 }}>
            {list.map((x) => (
              <button key={x.account_size} type="button" className="mono" aria-pressed={x.account_size === active.account_size} onClick={() => setSize(x.account_size)}>
                {inr(x.account_size)}
              </button>
            ))}
          </div>
        </div>
        {email && <p className="muted" style={{ fontSize: ".85rem" }}>Account will be created for <b>{email}</b>.</p>}
      </div>
      <div className="glass card" style={{ position: "sticky", top: 90 }}>
        <h3>Order summary</h3>
        <div className="sumln"><span className="muted">{plan.name} · {sizeLabel(active.account_size)} simulated</span><span className="mono">{inr(base)}</span></div>
        <div className="sumln"><span className="muted">GST 18% (sample)</span><span className="mono">{inr(total - base)}</span></div>
        <div className="sumln tot"><span>Total</span><span className="mono">{inr(total)}</span></div>
        <label className="check" htmlFor="co-agree">
          <input id="co-agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I understand this is a simulated trading account, the fee is a platform fee and not an investment, and most participants do not earn rewards.</span>
        </label>
        {error && <p className="msg err" role="alert">{error}</p>}
        <button className="btn primary" type="button" onClick={pay} disabled={busy}>
          {busy ? "Creating account" : "Complete demo purchase"}
        </button>
        <p className="muted" style={{ fontSize: ".76rem" }}>Demo checkout: no payment is taken. A payment gateway is connected before launch.</p>
      </div>
    </div>
  );
}
