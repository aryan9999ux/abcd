"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { inr } from "@/components/trading/format";
import { accountView, compact } from "./calc";
import { usePortal } from "./PortalProvider";
import { Badge, PageHead } from "./ui";

/** A glass ball that fills with a moving wave as the figure rises. */
function Ball({ pct, title, value, sub, tone }: { pct: number; title: string; value: string; sub: string; tone: "ok" | "warn" | "bad" | "brand" }) {
  const p = Math.max(0, Math.min(100, pct));
  const cid = "c" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const y = 118 - (p / 100) * 112;
  const wave = "M0 8 Q15 0 30 8 T60 8 T90 8 T120 8 T150 8 T180 8 T210 8 T240 8 V140 H0Z";
  return (
    <div className="fd-ball">
      <div className={`fd-orb ${tone}`}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <defs><clipPath id={cid}><circle cx="60" cy="60" r="56" /></clipPath></defs>
          <circle cx="60" cy="60" r="57" className="fd-ring" />
          <g clipPath={`url(#${cid})`}>
            <g className="fd-lvl" style={{ transform: `translateY(${y}px)` }}>
              <path className="fd-w2" d={wave} />
              <path className="fd-w1" d={wave} />
            </g>
          </g>
        </svg>
        <b>{Math.round(p)}%</b>
      </div>
      <div className="fd-txt"><small>{title}</small><strong>{value}</strong><span>{sub}</span></div>
    </div>
  );
}

const toneOf = (p: number): "ok" | "warn" | "bad" => (p > 80 ? "bad" : p > 55 ? "warn" : "ok");

export default function FundsPage() {
  const { accounts, plans, metrics } = usePortal();
  const live = accounts.filter((a) => a.status === "active" || a.status === "passed");
  const list = live.length ? live : accounts;
  const [sel, setSel] = useState<string | null>(null);
  const a = list.find((x) => x.id === sel) ?? list[0];
  if (!a) {
    return (
      <>
        <PageHead title="Funds" sub="Your margin, limits and balances in one place." />
        <section className="pt-card"><p className="pt-empty">You have no account yet. Buy one to see your funds here.</p><p style={{ textAlign: "center" }}><Link className="pt-btn primary" href="/checkout">Buy account</Link></p></section>
      </>
    );
  }
  const m = metrics[a.id] ?? null;
  const v = accountView(a, m);
  const marginUsed = m?.marginUsed ?? 0;
  const total = marginUsed + (m?.available ?? Math.max(0, v.equity - marginUsed));
  const usedPct = total > 0 ? (marginUsed / total) * 100 : 0;
  const dailyPct = v.dailyLimit > 0 ? (v.dailyUsed / v.dailyLimit) * 100 : 0;
  const ddPct = v.ddLimit > 0 ? (v.ddUsed / v.ddLimit) * 100 : 0;
  const tgt = v.targetAmt ? Math.max(0, Math.min(100, (v.profit / v.targetAmt) * 100)) : null;
  const plan = plans.find((p) => p.key === a.plan_key)?.name ?? a.plan_key;

  const rows: [string, string, string?][] = [
    ["Starting capital", inr(v.size)],
    ["Closed balance", inr(a.balance)],
    ["Live equity", inr(v.equity)],
    ["Open profit or loss", inr(m?.unrealized ?? 0), (m?.unrealized ?? 0) > 0 ? "up" : (m?.unrealized ?? 0) < 0 ? "down" : ""],
    ["Margin used", inr(marginUsed)],
    ["Margin available", inr(m?.available ?? Math.max(0, v.equity - marginUsed))],
    ["Today's profit or loss", inr(v.dayPl), v.dayPl > 0 ? "up" : v.dayPl < 0 ? "down" : ""],
    ["Daily loss left", inr(Math.max(0, v.dailyLimit - v.dailyUsed))],
    ["Loss room before breach", inr(Math.max(0, v.equity - v.floor))],
  ];

  return (
    <>
      <PageHead title="Funds" sub="Margin in use, how close each limit is, and what is left to trade with."
        actions={<Link className="pt-btn primary" href="/terminal">Open terminal</Link>} />
      {list.length > 1 && (
        <div className="pt-tabsbar" role="tablist">
          {list.map((x) => <button key={x.id} role="tab" aria-selected={x.id === a.id} onClick={() => setSel(x.id)}>{compact(x.account_size)}</button>)}
        </div>
      )}
      <section className="pt-card">
        <div className="pt-ch"><h2>{compact(a.account_size)} · {plan}</h2><Badge tone={a.status === "breached" ? "bad" : a.status === "active" ? "ok" : "brand"}>{a.status === "active" ? "Active" : a.status === "passed" ? "Passed" : a.status === "breached" ? "Breached" : "Closed"}</Badge></div>
        <div className="fd-balls">
          <Ball pct={usedPct} title="Margin used" value={inr(marginUsed)} sub={`of ${inr(total)} total margin`} tone={toneOf(usedPct)} />
          <Ball pct={dailyPct} title="Daily loss used" value={inr(v.dailyUsed)} sub={`of ${inr(v.dailyLimit)} daily limit`} tone={toneOf(dailyPct)} />
          <Ball pct={ddPct} title="Overall loss used" value={inr(v.ddUsed)} sub={`of ${inr(v.ddLimit)} allowed`} tone={toneOf(ddPct)} />
          {tgt != null && <Ball pct={tgt} title="Profit target" value={inr(Math.max(0, v.profit))} sub={`of ${inr(v.targetAmt ?? 0)} target`} tone="brand" />}
        </div>
      </section>
      <section className="pt-card flush">
        <div className="pt-ch"><h2>Balances</h2></div>
        <div className="fd-rows">{rows.map(([k, val, t]) => <div key={k}><span>{k}</span><b className={t}>{val}</b></div>)}</div>
        <p className="rp-note" style={{ padding: "0 20px 16px" }}>Capital is simulated. Margin and limits update live while the market is open.</p>
      </section>
    </>
  );
}
