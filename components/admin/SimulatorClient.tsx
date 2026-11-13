"use client";
import { useMemo, useState } from "react";

interface Arch { name: string; share: number; winRate: number; rr: number; tradesPerDay: number; riskPct: number }
interface PlanRow { key: string; name: string; rules: unknown; prices: { size: number; price: number }[] }
interface Result {
  traders: number; purchases: number; feeRevenue: number; payoutCost: number; net: number; marginPct: number; breached: number;
  paidAtLeastOnce: number; avgPayoutsPerPaid: number; avgRewardPerPaidTrader: number; passedAllPhases: number;
  byArchetype: { name: string; traders: number; breachedPct: number; paidPct: number; avgReward: number }[];
}
const inr = (n: number) => (n < 0 ? "-" : "") + "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");
const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) + "%" : "0%");

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: "Bad response" }));
  if (!j.ok) throw new Error(j.error || "Failed");
  return j;
}

export function SimulatorClient({ plans, archetypes }: { plans: PlanRow[]; archetypes: Arch[] }) {
  const [planKey, setPlanKey] = useState(plans[0]?.key ?? "");
  const plan = useMemo(() => plans.find((p) => p.key === planKey), [plans, planKey]);
  const [size, setSize] = useState(plans[0]?.prices[0]?.size ?? 1000000);
  const [rulesText, setRulesText] = useState(JSON.stringify(plans[0]?.rules ?? {}, null, 2));
  const [arch, setArch] = useState<Arch[]>(archetypes);
  const [traders, setTraders] = useState(3000);
  const [horizon, setHorizon] = useState(180);
  const [rebuy, setRebuy] = useState(0.5);
  const [maxRebuys, setMaxRebuys] = useState(3);
  const [res, setRes] = useState<Result | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fee = plan?.prices.find((p) => p.size === size)?.price ?? 0;

  const pick = (k: string) => {
    const p = plans.find((x) => x.key === k)!;
    setPlanKey(k); setSize(p.prices[0]?.size ?? 1000000); setRulesText(JSON.stringify(p.rules, null, 2)); setRes(null); setMsg("");
  };
  const parsed = () => { try { return JSON.parse(rulesText); } catch { throw new Error("The rules are not valid JSON."); } };
  const run = async () => {
    setBusy(true); setMsg("");
    try {
      const j = await post("/api/admin/simulate", { rules: parsed(), accountSize: size, feeInr: fee, traders, horizonDays: horizon, rebuyProb: rebuy, maxRebuys, archetypes: arch });
      setRes(j.result);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setMsg("");
    try { await post("/api/admin/plans", { planKey, rules: parsed() }); setMsg("Saved. New purchases use these rules. Existing accounts keep theirs."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const setA = (i: number, k: keyof Arch, v: string) => setArch((a) => a.map((x, j) => (j === i ? { ...x, [k]: k === "name" ? v : num(v) } : x)));

  return (
    <main className="wrap view" style={{ paddingBlock: 40 }}>
      <span className="eyebrow">Admin only</span>
      <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", marginTop: 8 }}>Simulator &amp; rules</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 680 }}>
        Edit a plan's rules, then simulate thousands of traders to see fee income against reward cost. The trader types below are your assumptions, not facts. Real results after launch matter more.
      </p>

      <div className="glass" style={{ padding: 20, marginTop: 20, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <label>Plan<br /><select value={planKey} onChange={(e) => pick(e.target.value)}>{plans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
          <label>Account size<br /><select value={size} onChange={(e) => setSize(Number(e.target.value))}>{plan?.prices.map((p) => <option key={p.size} value={p.size}>{inr(p.size)} · fee {inr(p.price)}</option>)}</select></label>
          <label>Traders<br /><input type="number" value={traders} onChange={(e) => setTraders(num(e.target.value))} style={{ width: 90 }} /></label>
          <label>Days<br /><input type="number" value={horizon} onChange={(e) => setHorizon(num(e.target.value))} style={{ width: 80 }} /></label>
          <label>Rebuy chance<br /><input type="number" step="0.1" value={rebuy} onChange={(e) => setRebuy(num(e.target.value))} style={{ width: 80 }} /></label>
          <label>Max rebuys<br /><input type="number" value={maxRebuys} onChange={(e) => setMaxRebuys(num(e.target.value))} style={{ width: 70 }} /></label>
        </div>
        <label>Rules (JSON)<br /><textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={16} style={{ width: "100%", fontFamily: "var(--mono, monospace)", fontSize: ".82rem" }} /></label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn primary" disabled={busy} onClick={run}>{busy ? "Working…" : "Run simulation"}</button>
          <button className="btn" disabled={busy} onClick={save}>Save rules to this plan</button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      </div>

      <div className="glass" style={{ padding: 20, marginTop: 16, overflowX: "auto" }}>
        <strong>Trader types</strong>
        <table style={{ width: "100%", marginTop: 10, fontSize: ".85rem", borderSpacing: 6 }}>
          <thead><tr className="muted"><th align="left">Type</th><th>Share %</th><th>Win rate</th><th>Reward : risk</th><th>Trades/day</th><th>Risk % per trade</th></tr></thead>
          <tbody>{arch.map((a, i) => (
            <tr key={i}>
              <td><input value={a.name} onChange={(e) => setA(i, "name", e.target.value)} /></td>
              {(["share", "winRate", "rr", "tradesPerDay", "riskPct"] as const).map((k) => (
                <td key={k}><input type="number" step="0.01" value={a[k]} onChange={(e) => setA(i, k, e.target.value)} style={{ width: 80 }} /></td>
              ))}
            </tr>))}</tbody>
        </table>
      </div>

      {res && (
        <div className="glass" style={{ padding: 20, marginTop: 16, display: "grid", gap: 8 }}>
          <strong>Result · {res.traders.toLocaleString("en-IN")} traders, {res.purchases.toLocaleString("en-IN")} purchases</strong>
          <div>Fee income (excl. GST): {inr(res.feeRevenue)}</div>
          <div>Rewards and fee refunds paid: {inr(res.payoutCost)}</div>
          <div><strong>Net: {inr(res.net)} ({res.marginPct.toFixed(0)}% of fee income)</strong></div>
          <div className="muted">Breached at least once {pct(res.breached, res.traders)} · got at least one reward {pct(res.paidAtLeastOnce, res.traders)} · reached funded {pct(res.passedAllPhases, res.traders)}</div>
          <div className="muted">Average reward per paid trader {inr(res.avgRewardPerPaidTrader)} · {res.avgPayoutsPerPaid.toFixed(1)} payouts each</div>
          <table style={{ width: "100%", marginTop: 6, fontSize: ".85rem" }}>
            <thead><tr className="muted"><th align="left">Type</th><th>Traders</th><th>Breached</th><th>Paid</th><th>Avg reward</th></tr></thead>
            <tbody>{res.byArchetype.map((b) => <tr key={b.name}><td>{b.name}</td><td align="center">{b.traders}</td><td align="center">{b.breachedPct.toFixed(0)}%</td><td align="center">{b.paidPct.toFixed(0)}%</td><td align="center">{inr(b.avgReward)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </main>
  );
}
