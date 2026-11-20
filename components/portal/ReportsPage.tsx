"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { istDate } from "@/lib/engine/pure";
import { dateTime, inr, nameOfKey } from "@/components/trading/format";
import type { AccountRow, OrderRow, TradeRow } from "@/components/trading/types";
import { compact } from "./calc";
import { usePortal } from "./PortalProvider";
import { Badge, Kpi, PageHead } from "./ui";

type Tab = "diary" | "trades" | "orders" | "ledger";
const TABS: [Tab, string][] = [["diary", "P&L diary"], ["trades", "Trade history"], ["orders", "Order history"], ["ledger", "Ledger"]];

const n = Number;
const short = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? "-" : v > 0 ? "+" : "";
  if (a >= 10_000_000) return `${s}${+(a / 10_000_000).toFixed(2)}Cr`;
  if (a >= 100_000) return `${s}${+(a / 100_000).toFixed(2)}L`;
  if (a >= 1000) return `${s}${+(a / 1000).toFixed(1)}K`;
  return `${s}${Math.round(a)}`;
};
const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "");
const dayOf = (iso: string) => istDate(new Date(iso).getTime());
const label = (a: AccountRow, plans: { key: string; name: string }[]) => `${compact(a.account_size)} · ${plans.find((p) => p.key === a.plan_key)?.name ?? a.plan_key}`;

function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReportsPage() {
  const { accounts, plans, rewards } = usePortal();
  const [tab, setTab] = useState<Tab>("diary");
  const [acc, setAcc] = useState("all");
  const [trades, setTrades] = useState<TradeRow[] | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const sb = browserClient();
    void Promise.all([
      sb.from("trades").select("*").order("executed_at", { ascending: false }).limit(3000),
      sb.from("orders").select("*").order("created_at", { ascending: false }).limit(1500),
    ]).then(([t, o]) => {
      if (!live) return;
      if (t.error || o.error) { setErr("Could not load your history. Refresh to try again."); setTrades([]); setOrders([]); return; }
      setTrades((t.data as TradeRow[]).map((r) => ({ ...r, qty: n(r.qty), price: n(r.price), realized_pnl: n(r.realized_pnl) })));
      setOrders((o.data as OrderRow[]).map((r) => ({ ...r, qty: n(r.qty), price: r.price == null ? null : n(r.price), strike: r.strike == null ? null : n(r.strike) })));
    });
    return () => { live = false; };
  }, []);

  const ledgerAcc = acc === "all" ? accounts[0]?.id ?? "" : acc;
  const fTrades = useMemo(() => (trades ?? []).filter((t) => acc === "all" || t.account_id === acc), [trades, acc]);
  const fOrders = useMemo(() => (orders ?? []).filter((t) => acc === "all" || t.account_id === acc), [orders, acc]);

  return (
    <>
      <PageHead title="Reports" sub="Your daily P&L, every trade and order, and a running ledger of your account."
        actions={
          <select className="rp-sel" value={acc} onChange={(e) => setAcc(e.target.value)} aria-label="Account">
            {tab !== "ledger" && <option value="all">All accounts</option>}
            {accounts.map((a) => <option key={a.id} value={a.id}>{label(a, plans)}</option>)}
          </select>
        } />
      <div className="pt-tabsbar" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); if (k === "ledger" && acc === "all") setAcc(accounts[0]?.id ?? "all"); }}>{l}</button>)}
      </div>
      {err && <div className="pt-banner warn"><div><b>{err}</b></div></div>}
      {trades === null || orders === null ? <div className="pt-card"><p className="pt-empty">Loading your history…</p></div>
        : accounts.length === 0 ? <div className="pt-card"><p className="pt-empty">Buy an account and start trading. Your reports appear here.</p><p style={{ textAlign: "center" }}><Link className="pt-btn primary" href="/checkout">Buy account</Link></p></div>
        : tab === "diary" ? <Diary trades={fTrades} />
        : tab === "trades" ? <Trades trades={fTrades} accounts={accounts} plans={plans} showAcc={acc === "all"} />
        : tab === "orders" ? <Orders orders={fOrders} accounts={accounts} plans={plans} showAcc={acc === "all"} />
        : <Ledger account={accounts.find((a) => a.id === ledgerAcc) ?? accounts[0]} trades={(trades ?? []).filter((t) => t.account_id === ledgerAcc)} rewards={rewards.filter((r) => r.account_id === ledgerAcc)} />}
    </>
  );
}

/* ---------------- P&L diary ---------------- */
function Diary({ trades }: { trades: TradeRow[] }) {
  const today = istDate(Date.now());
  const [ym, setYm] = useState(today.slice(0, 7));
  const [sel, setSel] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, { pnl: number; count: number }>();
    for (const t of trades) {
      const d = dayOf(t.executed_at), c = m.get(d) ?? { pnl: 0, count: 0 };
      c.pnl += t.realized_pnl; c.count += 1; m.set(d, c);
    }
    return m;
  }, [trades]);

  const [y, mo] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);

  const month = [...byDay.entries()].filter(([d]) => d.startsWith(ym));
  const net = month.reduce((t, [, v]) => t + v.pnl, 0);
  const green = month.filter(([, v]) => v.pnl > 0).length, red = month.filter(([, v]) => v.pnl < 0).length;
  const best = month.reduce((b, [d, v]) => (v.pnl > (b?.pnl ?? -Infinity) ? { d, pnl: v.pnl } : b), null as { d: string; pnl: number } | null);
  const worst = month.reduce((b, [d, v]) => (v.pnl < (b?.pnl ?? Infinity) ? { d, pnl: v.pnl } : b), null as { d: string; pnl: number } | null);
  const peak = Math.max(1, ...month.map(([, v]) => Math.abs(v.pnl)));
  const shift = (k: number) => { const d = new Date(Date.UTC(y, mo - 1 + k, 1)); setYm(d.toISOString().slice(0, 7)); setSel(null); };
  const title = first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const dayTrades = sel ? trades.filter((t) => dayOf(t.executed_at) === sel).sort((a, b) => a.executed_at.localeCompare(b.executed_at)) : [];
  const dd = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <>
      <div className="pt-kpis">
        <Kpi label="Net P&L this month" value={inr(net)} tone={net > 0 ? "up" : net < 0 ? "down" : undefined} sub={`${month.length} trading ${month.length === 1 ? "day" : "days"}`} />
        <Kpi label="Win days" value={`${green} / ${green + red}`} sub={green + red ? `${Math.round((green / (green + red)) * 100)}% win rate` : "No closed days yet"} />
        <Kpi label="Best day" value={best ? inr(best.pnl) : "—"} tone={best && best.pnl > 0 ? "up" : undefined} sub={best ? dd(best.d) : ""} />
        <Kpi label="Worst day" value={worst ? inr(worst.pnl) : "—"} tone={worst && worst.pnl < 0 ? "down" : undefined} sub={worst ? dd(worst.d) : ""} />
      </div>
      <section className="pt-card">
        <div className="rp-cal-h">
          <button className="rp-arrow" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <h2>{title}</h2>
          <button className="rp-arrow" onClick={() => shift(1)} disabled={ym >= today.slice(0, 7)} aria-label="Next month">›</button>
        </div>
        <div className="rp-cal" role="grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <b key={d} className="rp-dow">{d}</b>)}
          {cells.map((d, i) => {
            if (!d) return <span key={i} className="rp-cell blank" />;
            const v = byDay.get(d);
            const k = v ? Math.min(1, Math.abs(v.pnl) / peak) : 0;
            const bg = v && v.pnl !== 0 ? `color-mix(in srgb, var(${v.pnl > 0 ? "--up" : "--down"}) ${14 + Math.round(k * 34)}%, transparent)` : undefined;
            return (
              <button key={d} className={`rp-cell${d === today ? " today" : ""}${sel === d ? " sel" : ""}${v ? " has" : ""}`} style={{ background: bg }} onClick={() => setSel(sel === d ? null : d)} disabled={!v} aria-label={`${d}${v ? ` ${inr(v.pnl)}` : ""}`}>
                <i>{Number(d.slice(8))}</i>
                {v && <em className={tone(v.pnl)}>{short(v.pnl)}</em>}
              </button>
            );
          })}
        </div>
        <p className="rp-note">Green days are profit, red days are loss. Tap a day to see its trades.</p>
      </section>
      {sel && (
        <section className="pt-card flush">
          <div className="pt-ch"><h2>{dd(sel)} · {dayTrades.length} {dayTrades.length === 1 ? "trade" : "trades"}</h2><button className="pt-link" onClick={() => setSel(null)}>Close</button></div>
          <div className="rp-list">
            {dayTrades.map((t) => (
              <div key={t.id} className="rp-row">
                <div><b>{nameOfKey(t.instrument)}</b><small>{new Date(t.executed_at).toLocaleTimeString("en-IN", { hour12: false })} · {t.side} {t.qty} @ {inr(t.price)}</small></div>
                <span className={tone(t.realized_pnl)}>{t.realized_pnl === 0 ? "Opened" : inr(t.realized_pnl)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ---------------- shared list pieces ---------------- */
function useFilter<T>(rows: T[], text: (r: T) => string) {
  const [q, setQ] = useState("");
  const out = useMemo(() => { const s = q.trim().toLowerCase(); return s ? rows.filter((r) => text(r).toLowerCase().includes(s)) : rows; }, [rows, q, text]);
  return { q, setQ, out };
}
function Pager({ total, page, setPage, size }: { total: number; page: number; setPage: (p: number) => void; size: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div className="rp-pager">
      <button className="pt-btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page + 1} of {pages}</span>
      <button className="pt-btn sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}

/* ---------------- trade history ---------------- */
function Trades({ trades, accounts, plans, showAcc }: { trades: TradeRow[]; accounts: AccountRow[]; plans: { key: string; name: string }[]; showAcc: boolean }) {
  const [res, setRes] = useState<"all" | "win" | "loss">("all");
  const [page, setPage] = useState(0);
  const base = useMemo(() => trades.filter((t) => res === "all" || (res === "win" ? t.realized_pnl > 0 : t.realized_pnl < 0)), [trades, res]);
  const { q, setQ, out } = useFilter(base, (t) => nameOfKey(t.instrument));
  useEffect(() => setPage(0), [q, res]);
  const SIZE = 25, rows = out.slice(page * SIZE, page * SIZE + SIZE);
  const accName = (id: string) => { const a = accounts.find((x) => x.id === id); return a ? label(a, plans) : ""; };
  const net = out.reduce((t, x) => t + x.realized_pnl, 0);

  return (
    <section className="pt-card flush">
      <div className="rp-bar">
        <input className="rp-in" placeholder="Search instrument" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="rp-seg">{(["all", "win", "loss"] as const).map((k) => <button key={k} aria-pressed={res === k} onClick={() => setRes(k)}>{k === "all" ? "All" : k === "win" ? "Wins" : "Losses"}</button>)}</div>
        <button className="pt-btn sm" onClick={() => download("trade-history.csv", [["Time", "Account", "Instrument", "Side", "Qty", "Price", "P&L"], ...out.map((t) => [t.executed_at, accName(t.account_id), nameOfKey(t.instrument), t.side, t.qty, t.price, t.realized_pnl])])}>Download CSV</button>
      </div>
      {out.length === 0 ? <p className="pt-empty">No trades yet. When you close a trade, it is listed here.</p> : (
        <>
          <div className="pt-scroll rp-desk"><table className="pt-tbl">
            <thead><tr><th>Time</th><th>Instrument</th><th>Side</th><th>Qty</th><th>Price</th><th>P&L</th></tr></thead>
            <tbody>{rows.map((t) => (
              <tr key={t.id}>
                <td>{dateTime(t.executed_at)}{showAcc && <small className="rp-sub">{accName(t.account_id)}</small>}</td>
                <td>{nameOfKey(t.instrument)}</td>
                <td><span className={t.side === "Buy" ? "up" : "down"}>{t.side}</span></td>
                <td>{t.qty}</td><td>{inr(t.price)}</td>
                <td className={tone(t.realized_pnl)}>{t.realized_pnl === 0 ? "—" : inr(t.realized_pnl)}</td>
              </tr>))}</tbody>
          </table></div>
          <div className="rp-list rp-mob">{rows.map((t) => (
            <div key={t.id} className="rp-row">
              <div><b>{nameOfKey(t.instrument)}</b><small><span className={t.side === "Buy" ? "up" : "down"}>{t.side}</span> {t.qty} @ {inr(t.price)} · {dateTime(t.executed_at)}</small>{showAcc && <small>{accName(t.account_id)}</small>}</div>
              <span className={tone(t.realized_pnl)}>{t.realized_pnl === 0 ? "Opened" : inr(t.realized_pnl)}</span>
            </div>))}</div>
          <div className="rp-foot"><span>{out.length} {out.length === 1 ? "trade" : "trades"}</span><span>Net P&L <b className={tone(net)}>{inr(net)}</b></span></div>
          <Pager total={out.length} page={page} setPage={setPage} size={SIZE} />
        </>
      )}
    </section>
  );
}

/* ---------------- order history ---------------- */
const OTONE = { filled: "ok", pending: "warn", cancelled: "n", rejected: "bad" } as const;
function Orders({ orders, accounts, plans, showAcc }: { orders: OrderRow[]; accounts: AccountRow[]; plans: { key: string; name: string }[]; showAcc: boolean }) {
  const [st, setSt] = useState<"all" | OrderRow["status"]>("all");
  const [page, setPage] = useState(0);
  const base = useMemo(() => orders.filter((o) => st === "all" || o.status === st), [orders, st]);
  const { q, setQ, out } = useFilter(base, (o) => o.instrument + " " + nameOfKey(o.instrument));
  useEffect(() => setPage(0), [q, st]);
  const SIZE = 25, rows = out.slice(page * SIZE, page * SIZE + SIZE);
  const accName = (id: string) => { const a = accounts.find((x) => x.id === id); return a ? label(a, plans) : ""; };
  const price = (o: OrderRow) => (o.price == null ? "Market" : inr(o.price));

  return (
    <section className="pt-card flush">
      <div className="rp-bar">
        <input className="rp-in" placeholder="Search instrument" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="rp-seg">{(["all", "filled", "pending", "cancelled", "rejected"] as const).map((k) => <button key={k} aria-pressed={st === k} onClick={() => setSt(k)}>{k === "all" ? "All" : k[0].toUpperCase() + k.slice(1)}</button>)}</div>
        <button className="pt-btn sm" onClick={() => download("order-history.csv", [["Time", "Account", "Instrument", "Side", "Type", "Qty", "Price", "Status", "Reason"], ...out.map((o) => [o.created_at, accName(o.account_id), nameOfKey(o.instrument), o.side, o.order_type, o.qty, o.price ?? "Market", o.status, o.reject_reason ?? ""])])}>Download CSV</button>
      </div>
      {out.length === 0 ? <p className="pt-empty">No orders yet. Every order you place is listed here, with its result.</p> : (
        <>
          <div className="pt-scroll rp-desk"><table className="pt-tbl">
            <thead><tr><th>Time</th><th>Instrument</th><th>Side</th><th>Type</th><th>Qty</th><th>Price</th><th>Status</th></tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.id}>
                <td>{dateTime(o.created_at)}{showAcc && <small className="rp-sub">{accName(o.account_id)}</small>}</td>
                <td>{nameOfKey(o.instrument)}</td>
                <td><span className={o.side === "Buy" ? "up" : "down"}>{o.side}</span></td>
                <td>{o.order_type}</td><td>{o.qty}</td><td>{price(o)}</td>
                <td><Badge tone={OTONE[o.status]}>{o.status[0].toUpperCase() + o.status.slice(1)}</Badge>{o.reject_reason && <small className="rp-sub wrap">{o.reject_reason}</small>}</td>
              </tr>))}</tbody>
          </table></div>
          <div className="rp-list rp-mob">{rows.map((o) => (
            <div key={o.id} className="rp-row">
              <div><b>{nameOfKey(o.instrument)}</b><small><span className={o.side === "Buy" ? "up" : "down"}>{o.side}</span> {o.qty} · {o.order_type} · {price(o)}</small><small>{dateTime(o.created_at)}</small>{o.reject_reason && <small>{o.reject_reason}</small>}</div>
              <Badge tone={OTONE[o.status]}>{o.status[0].toUpperCase() + o.status.slice(1)}</Badge>
            </div>))}</div>
          <div className="rp-foot"><span>{out.length} {out.length === 1 ? "order" : "orders"}</span></div>
          <Pager total={out.length} page={page} setPage={setPage} size={SIZE} />
        </>
      )}
    </section>
  );
}

/* ---------------- ledger ---------------- */
interface Entry { at: string; title: string; note?: string; amount: number | null; kind: "capital" | "pnl" | "payout" | "info"; status?: string; bal: number | null }
function Ledger({ account, trades, rewards }: { account: AccountRow | undefined; trades: TradeRow[]; rewards: { id: string; amount_inr: number; fee_refund_inr?: number | null; status: string; requested_at: string; paid_at: string | null; payout_ref: string | null }[] }) {
  const entries = useMemo<Entry[]>(() => {
    if (!account) return [];
    const out: Entry[] = [{ at: account.created_at, title: "Starting capital", note: "Simulated trading capital", amount: account.account_size, kind: "capital", bal: account.account_size }];
    const days = new Map<string, { pnl: number; c: number; at: string }>();
    for (const t of trades) { const d = dayOf(t.executed_at), v = days.get(d) ?? { pnl: 0, c: 0, at: t.executed_at }; v.pnl += t.realized_pnl; v.c++; if (t.executed_at > v.at) v.at = t.executed_at; days.set(d, v); }
    const ev: Entry[] = [...days.entries()].filter(([, v]) => v.pnl !== 0).map(([d, v]) => ({ at: v.at, title: "Trading P&L", note: `${new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })} · ${v.c} ${v.c === 1 ? "trade" : "trades"}`, amount: v.pnl, kind: "pnl" as const, bal: null }));
    for (const r of rewards) {
      ev.push({ at: r.paid_at ?? r.requested_at, title: r.status === "paid" ? "Payout paid" : r.status === "rejected" ? "Payout declined" : r.status === "approved" ? "Payout approved" : "Payout requested", note: r.payout_ref ? `Ref ${r.payout_ref}` : "Paid from our funds, not deducted from your balance", amount: r.amount_inr, kind: "payout", status: r.status, bal: null });
      if (r.fee_refund_inr && r.fee_refund_inr > 0 && r.status !== "rejected") ev.push({ at: r.paid_at ?? r.requested_at, title: "Fee refund", note: "Returned with your payout", amount: r.fee_refund_inr, kind: "payout", status: r.status, bal: null });
    }
    ev.sort((a, b) => a.at.localeCompare(b.at));
    let bal = account.account_size;
    for (const e of ev) { if (e.kind === "pnl") { bal += e.amount ?? 0; e.bal = bal; } out.push(e); }
    return out;
  }, [account, trades, rewards]);

  if (!account) return null;
  const net = account.balance - account.account_size;
  const paid = rewards.filter((r) => r.status === "paid").reduce((t, r) => t + r.amount_inr, 0);
  return (
    <>
      <div className="pt-kpis">
        <Kpi label="Starting capital" value={inr(account.account_size)} sub="Simulated" />
        <Kpi label="Net P&L" value={inr(net)} tone={net > 0 ? "up" : net < 0 ? "down" : undefined} />
        <Kpi label="Balance" value={inr(account.balance)} />
        <Kpi label="Payouts received" value={inr(paid)} />
      </div>
      <section className="pt-card flush">
        <div className="rp-bar"><b className="rp-t">Ledger</b><span className="rp-sp" />
          <button className="pt-btn sm" onClick={() => download("ledger.csv", [["Date", "Entry", "Note", "Amount", "Balance"], ...entries.map((e) => [e.at, e.title, e.note ?? "", e.amount ?? "", e.bal ?? ""])])}>Download CSV</button></div>
        <div className="pt-scroll rp-desk"><table className="pt-tbl">
          <thead><tr><th>Date</th><th>Entry</th><th>Amount</th><th>Balance</th></tr></thead>
          <tbody>{entries.map((e, i) => (
            <tr key={i}>
              <td>{dateTime(e.at)}</td>
              <td><b className="rp-et">{e.title}</b><small className="rp-sub wrap">{e.note}</small></td>
              <td className={e.kind === "pnl" ? tone(e.amount ?? 0) : e.kind === "payout" ? "brand" : ""}>{e.amount == null ? "" : e.kind === "pnl" ? inr(e.amount) : inr(e.amount)}{e.status && <Badge tone={e.status === "paid" ? "ok" : e.status === "rejected" ? "bad" : "warn"}>{e.status}</Badge>}</td>
              <td>{e.bal == null ? "" : inr(e.bal)}</td>
            </tr>))}</tbody>
        </table></div>
        <div className="rp-list rp-mob">{entries.map((e, i) => (
          <div key={i} className="rp-row">
            <div><b>{e.title}</b><small>{e.note}</small><small>{dateTime(e.at)}</small></div>
            <div className="rp-end"><span className={e.kind === "pnl" ? tone(e.amount ?? 0) : ""}>{e.amount == null ? "" : inr(e.amount)}</span>{e.bal != null && <small>Bal {inr(e.bal)}</small>}</div>
          </div>))}</div>
      </section>
    </>
  );
}
