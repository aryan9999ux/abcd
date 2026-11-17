"use client";
import Px from "./Px";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { instrumentKey, parseInstrumentKey, type InstrumentRef, type Side } from "@/lib/types";
import { priceOf } from "@/lib/market/pricing";
import { marketOpen } from "@/lib/engine/pure";
import { orderTypeAt, postJSON } from "./api";
import { mergeLive, pushTick } from "./candles";
import ChartPanel from "./ChartPanel";
import { STOCK_LEVERAGE, SYMBOLS, WATCHLIST, isIndexFO } from "./constants";
import { dateTime, inr, nameOf, nameOfKey, num, phaseLabel, statusLabel, timeOnly } from "./format";
import { Meter } from "./Meter";
import { accountMetrics, livePrice, positionPnl } from "./metrics";
import NoAccounts from "./NoAccounts";
import OptionChain from "./OptionChain";
import StatusStrip from "./StatusStrip";
import RulesPanel from "./RulesPanel";
import OrderTicket, { ticketUnits, type TicketState } from "./OrderTicket";
import Shell from "./Shell";
import "./tv.css";
import type { AccountRow, Candle, PlanRow } from "./types";
import { useContracts } from "./useContracts";
import { useQuotes } from "./useQuotes";
import { useToast } from "./useToast";
import { useTraderData } from "./useTraderData";

interface Props {
  initialAccounts: AccountRow[];
  plans: PlanRow[];
  initialAccountId: string | null;
  fromPrice?: number | null;
}

type View = "trade" | "chain" | "pos" | "ord" | "pnl";

export default function TerminalClient({ initialAccounts, plans, initialAccountId, fromPrice }: Props) {
  const [accountId, setAccountId] = useState<string | null>(initialAccountId);
  const data = useTraderData(initialAccounts, accountId);
  const contracts = useContracts();
  const toast = useToast();

  const [sel, setSel] = useState<InstrumentRef>({ underlying: "NIFTY", segment: "FUT" });
  const [chainExp, setChainExp] = useState("");
  const [view, setView] = useState<View>("trade");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");
  const [ticket, setTicket] = useState<TicketState>({ side: "Buy", type: "Market", qty: "1", price: "", stopLoss: "" });
  const [tf, setTf] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  // Contracts that need live prices: the selected one, open positions and pending orders.
  const contractKeys = useMemo(() => {
    const ks = new Set<string>();
    if (sel.segment !== "EQ" && sel.expiry) ks.add(instrumentKey(sel));
    for (const p of data.positions) if (!p.instrument.includes("|EQ|")) ks.add(p.instrument);
    for (const o of data.orders) if (o.status === "pending" && !o.instrument.includes("|EQ|")) ks.add(o.instrument);
    return [...ks].slice(0, 40);
  }, [sel, data.positions, data.orders]);
  const { quotes: spots, prev, source, error: quoteError } = useQuotes(SYMBOLS, contractKeys);

  const spec = contracts.specs[sel.underlying];
  const lot = sel.segment === "EQ" ? 1 : spec?.lot ?? null;

  // Once the real contract list is in, give the futures selection its first real expiry.
  useEffect(() => {
    if (sel.segment === "FUT" && !sel.expiry && spec?.futExpiries[0]) setSel((c) => ({ ...c, expiry: spec.futExpiries[0] }));
  }, [sel, spec]);

  const spot = spots[sel.underlying] ?? null;
  const ltp = priceOf(sel, spots) ?? null;
  const key = instrumentKey(sel);
  const fo = sel.segment !== "EQ";
  const selPrev = (fo ? prev[key] : prev[sel.underlying]) ?? null;
  const selChg = ltp != null && selPrev != null ? ltp - selPrev : null;

  // Live bars: the selected contract's real price folded into the current minute, only while the market is open.
  const live = useRef(new Map<string, Candle[]>());
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (ltp == null || !marketOpen(Date.now())) return;
    live.current.set(key, pushTick(live.current.get(key) ?? [], ltp, Date.now()));
    setVersion((v) => v + 1);
  }, [ltp, key]);

  // Real exchange candles for the chart, refreshed every 30 seconds.
  const [hist, setHist] = useState<{ k: string; candles: Candle[]; note: string | null }>({ k: "", candles: [], note: null });
  useEffect(() => {
    if (!contracts.ready && fo) return;
    if (fo && !sel.expiry) return;
    let stop = false;
    const k = `${key}|${tf}`;
    async function load() {
      try {
        const q = new URLSearchParams({ underlying: sel.underlying, segment: sel.segment, tf: String(tf) });
        if (sel.strike != null) q.set("strike", String(sel.strike));
        if (sel.expiry) q.set("expiry", sel.expiry);
        const res = await fetch(`/api/history?${q}`, { cache: "no-store" });
        const j = (await res.json()) as { ok: boolean; candles?: Candle[]; available?: boolean; error?: string };
        if (stop) return;
        if (j.ok) setHist({ k, candles: j.candles ?? [], note: j.available === false ? "No chart history for this contract." : null });
        else setHist((h) => ({ k, candles: h.k === k ? h.candles : [], note: j.error ?? "Chart history is not available right now." }));
      } catch { /* retry on the next interval */ }
    }
    load();
    const t = setInterval(load, 30_000);
    return () => { stop = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tf, contracts.ready]);

  const account = data.accounts.find((a) => a.id === accountId) ?? null;
  const plan = plans.find((p) => p.key === account?.plan_key);
  const accPositions = useMemo(() => data.positions.filter((p) => p.account_id === accountId), [data.positions, accountId]);
  const m = account ? accountMetrics(account, plan, accPositions, spots) : null;

  const curPos = accPositions.find((p) => p.instrument === key) ?? null;
  const pending = data.orders.filter((o) => o.account_id === accountId && o.status === "pending" && o.instrument === key);

  const candles = useMemo(() => {
    const h = hist.k === `${key}|${tf}` ? hist.candles : [];
    return mergeLive(h, live.current.get(key) ?? [], tf).slice(-90);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, hist, key, tf]);

  const blockedReason =
    !account ? "Select an account." :
    account.status === "breached" ? "This account is closed after a rule breach." :
    account.status === "passed" ? "This account has passed its phase and no longer accepts new orders." :
    account.status === "closed" ? "This account is closed." :
    fo && lot == null ? "Loading contract details from the exchange…" : null;

  function pick(ref: InstrumentRef, side?: Side) {
    setSel(ref);
    setPickerOpen(false);
    setTicket((t) => ({ ...t, price: "", stopLoss: "", ...(side ? { side } : {}) }));
    setMsg(null);
  }

  function pickUnderlying(u: string) {
    pick(isIndexFO(u) ? { underlying: u, segment: "FUT", expiry: contracts.specs[u]?.futExpiries[0] } : { underlying: u, segment: "EQ" });
  }

  async function sendOrder(side: Side, units: number, orderType: "Market" | "Limit" | "Stop", price?: number): Promise<boolean> {
    if (!accountId) return false;
    setBusy(true);
    const res = await postJSON<{ orderId: string; status: "filled" | "pending"; fillPrice?: number }>("/api/orders", {
      accountId,
      underlying: sel.underlying,
      segment: sel.segment,
      ...(sel.strike != null ? { strike: sel.strike } : {}),
      ...(sel.expiry ? { expiry: sel.expiry } : {}),
      side,
      orderType,
      qty: units,
      ...(orderType !== "Market" && price != null ? { price } : {}),
      ...(Number(ticket.stopLoss) > 0 ? { stopLoss: Number(ticket.stopLoss) } : {}),
    });
    setBusy(false);
    if (res.ok) {
      const text = res.status === "filled"
        ? `${side} ${units} ${nameOf(sel)} filled${res.fillPrice != null ? " at " + num(res.fillPrice) : ""}`
        : `${orderType} order placed: ${side} ${nameOf(sel)}${price != null ? " at " + num(price) : ""}`;
      setMsg({ text, err: false });
      toast.show(text);
      data.refetch();
      return true;
    }
    setMsg({ text: res.error, err: true });
    toast.show(res.error, true);
    return false;
  }

  function submitTicket() {
    const units = ticketUnits(sel, ticket.qty, lot ?? 1);
    const price = Number(ticket.price);
    void sendOrder(ticket.side, units, ticket.type, ticket.type === "Market" ? undefined : price);
  }

  async function chartOrder(side: Side, price: number, qty: number) {
    if (ltp == null) return false;
    const units = fo ? qty * (lot ?? 1) : qty;
    const t = orderTypeAt(side, price, ltp);
    return sendOrder(side, units, t.orderType, t.price);
  }

  async function act(url: string, body: object, ok: string) {
    const res = await postJSON(url, body);
    if (res.ok) toast.show(ok);
    else toast.show(res.error, true);
    data.refetch();
  }

  const closePosition = (instrument: string) => act("/api/positions/close", { accountId, instrument }, `Closed ${nameOfKey(instrument)}`);
  const cancelOrder = (orderId: string) => act("/api/orders/cancel", { accountId, orderId }, "Order cancelled");
  function squareAll() {
    if (!confirmAll) {
      setConfirmAll(true);
      setTimeout(() => setConfirmAll(false), 4000);
      return;
    }
    setConfirmAll(false);
    void act("/api/positions/close-all", { accountId }, "All positions closed");
  }

  if (data.accounts.length === 0) {
    return <Shell active="terminal"><NoAccounts what="trading terminal" fromPrice={fromPrice} /></Shell>;
  }

  const slot = (
    <label className="tr-f tr-acctsel">
      <select value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value)} aria-label="Trading account">
        {data.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.is_demo ? "Demo · " : ""}{plans.find((p) => p.key === a.plan_key)?.name ?? a.plan_key} · {inr(a.account_size)} · {phaseLabel(a.phase)}{a.status !== "active" ? ` · ${statusLabel(a.status)}` : ""}
          </option>
        ))}
      </select>
    </label>
  );

  const optExpiries = spec?.optExpiries ?? [];
  const chainExpiry = optExpiries.includes(chainExp) ? chainExp : optExpiries[0] ?? "";
  const acctOrders = data.orders.filter((o) => o.account_id === accountId).slice(0, 40);
  const acctTrades = data.trades.filter((t) => t.account_id === accountId);
  const noPrices = Object.keys(spots).length === 0;
  const pendingCount = data.orders.filter((o) => o.account_id === accountId && o.status === "pending").length;
  const active = account?.status === "active";
  const dayPl = m && account ? m.equity - account.day_start_equity : null;
  const demoLeft = account?.is_demo && account.demo_expires_at ? Math.max(0, new Date(account.demo_expires_at).getTime() - Date.now()) : null;
  const demoText = demoLeft == null ? "" : demoLeft > 86_400_000 ? `${Math.ceil(demoLeft / 86_400_000)} days left` : `${Math.max(1, Math.ceil(demoLeft / 3_600_000))} hours left`;

  const goTrade = (ref: InstrumentRef, side?: Side) => { pick(ref, side); setView("trade"); };

  const tabs: [View, string, string?][] = [
    ["trade", "Trade"],
    ["chain", "Option chain"],
    ["pos", "Positions", accPositions.length ? String(accPositions.length) : undefined],
    ["ord", "Orders", pendingCount ? String(pendingCount) : undefined],
    ["pnl", "P&L and rules"],
  ];

  return (
    <Shell active="terminal" accountId={accountId} slot={slot} ticker={(
      <div className="tr-ticker" aria-label="Indices">
        {["NIFTY", "BANKNIFTY", "SENSEX"].map((k) => {
          const px = spots[k], pv = prev[k], d = px != null && pv != null ? px - pv : null;
          return (
            <button key={k} onClick={() => { pickUnderlying(k); setView("trade"); }}>
              <small>{k}</small>
              <Px v={px} className="tr-mono" text={px == null ? "—" : num(px)} />
              <span className={"tr-mono " + (d == null ? "" : d >= 0 ? "tr-up" : "tr-down")}>{d == null || pv == null ? "" : `${d >= 0 ? "▲" : "▼"} ${Math.abs((d / pv) * 100).toFixed(2)}%`}</span>
            </button>
          );
        })}
      </div>
    )}>
      <div className="tv">
        <label className="tr-f tv-acct">
          <select value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value)} aria-label="Trading account">
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.is_demo ? "Demo · " : ""}{plans.find((p) => p.key === a.plan_key)?.name ?? a.plan_key} · {inr(a.account_size)} · {phaseLabel(a.phase)}
              </option>
            ))}
          </select>
        </label>
        {account?.is_demo && account.status === "active" && (
          <div className="tr-banner" role="status"><b>Demo account.</b> Same rules as the real plan, with no payouts. {demoText}.<Link className="tr-btn sm" href="/checkout">Get a real account</Link></div>
        )}
        {account?.status === "breached" && (
          <div className="tr-banner bad" role="alert">
            <b>Account closed.</b> {account.breach_reason ?? "A loss limit was reached."} Open positions were squared off.
            <Link className="tr-btn sm" href="/checkout">Buy a new account</Link>
          </div>
        )}
        {account?.status === "passed" && (
          <div className="tr-banner ok"><b>Phase passed.</b> This account no longer accepts new orders.<Link className="tr-btn sm" href="/dashboard">Go to dashboard</Link></div>
        )}
        {account?.status === "closed" && account.is_demo && (
          <div className="tr-banner"><b>Demo ended.</b> Pick a plan to keep trading with real payouts.<Link className="tr-btn sm" href="/checkout">Choose a plan</Link></div>
        )}
        {(quoteError || data.error) && <div className="tr-banner" role="status">{quoteError ?? data.error}</div>}

        {account && <StatusStrip account={account} m={m} openCount={accPositions.length} />}

        <nav className="tv-tabs" aria-label="Terminal sections">
          {tabs.map(([k, label, badge]) => (
            <button key={k} aria-current={view === k ? "page" : undefined} onClick={() => setView(k)}>
              {label}{badge && <i>{badge}</i>}
            </button>
          ))}
        </nav>

        {view === "trade" && (
          <div className="tv-trade">
            <section className="tr-glass tv-chart">
              <div className="tv-bar">
                <div className="tv-pick">
                  <button className="tv-sym" onClick={() => setPickerOpen((o) => !o)} aria-expanded={pickerOpen} aria-haspopup="listbox">
                    <b>{nameOf(sel)}</b><span aria-hidden="true">▾</span>
                  </button>
                  {pickerOpen && (
                    <div className="tv-menu" role="listbox" aria-label="Choose an instrument">
                      <input className="tr-search" autoFocus placeholder="Search symbol" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search symbols" />
                      <div className="tv-list">
                        {WATCHLIST.filter((w) => w.k.toLowerCase().includes(q.trim().toLowerCase())).map((w, i, arr) => {
                          const px = spots[w.k], pv = prev[w.k];
                          const d = px != null && pv != null ? px - pv : null;
                          return (
                            <div key={w.k}>
                              {(i === 0 || arr[i - 1].fo !== w.fo) && <div className="tr-sep">{w.fo ? "Index futures and options" : `Stocks · ${STOCK_LEVERAGE}× intraday`}</div>}
                              <button role="option" aria-selected={sel.underlying === w.k} className="tv-opt" onClick={() => { pickUnderlying(w.k); setQ(""); }}>
                                <span><b>{w.k}</b><small>{w.fo ? `Lot ${contracts.specs[w.k]?.lot ?? "—"}` : "NSE · Cash"}</small></span>
                                <span className="px"><Px v={px} text={px == null ? "—" : num(px)} className="pxv" /><small className={d == null ? "" : d >= 0 ? "tr-up" : "tr-down"}>{d == null || pv == null ? "—" : `${d >= 0 ? "+" : ""}${((d / pv) * 100).toFixed(2)}%`}</small></span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="tr-quote">
                  <span className="tr-mono">{ltp == null ? "—" : num(ltp)}</span>
                  {selChg != null && selPrev != null && <span className={"tr-mono " + (selChg >= 0 ? "tr-up" : "tr-down")}>{selChg >= 0 ? "+" : ""}{num(selChg)} ({((selChg / selPrev) * 100).toFixed(2)}%)</span>}
                  {source === "demo" && <span className="tr-pill">Sample prices</span>}
                </div>
              </div>
              <div className="tr-cbody">
                <ChartPanel
                  title={nameOf(sel)}
                  candles={candles}
                  last={ltp}
                  position={curPos && ltp != null ? { entry: curPos.avg_price, side: curPos.side, pnl: (ltp - curPos.avg_price) * curPos.qty * (curPos.side === "Buy" ? 1 : -1) } : null}
                  pending={pending.filter((o) => o.price != null).map((o) => ({ id: o.id, side: o.side, price: o.price as number }))}
                  tf={tf}
                  onTf={setTf}
                  qtyLabel={fo ? "Lots" : "Shares"}
                  disabled={!!blockedReason}
                  disabledText={blockedReason ?? undefined}
                  note={noPrices ? "Waiting for prices…" : hist.note ?? "Loading the chart from the exchange…"}
                  onOrder={chartOrder}
                />
              </div>
            </section>
            <aside className="tv-side">
              <OrderTicket
                inst={sel}
                lot={lot ?? 1}
                ltp={ltp}
                spot={spot}
                state={ticket}
                onChange={setTicket}
                available={m ? m.available : null}
                disabledReason={blockedReason}
                busy={busy}
                message={msg}
                onSubmit={submitTicket}
              />
              {curPos && (
                <div className="tr-glass tv-cur">
                  <div><small>Open position</small><b>{curPos.side} {curPos.qty} · avg {num(curPos.avg_price)}</b></div>
                  <button className="tr-btn sm" disabled={!active} onClick={() => closePosition(curPos.instrument)}>Exit</button>
                </div>
              )}
            </aside>
          </div>
        )}

        {view === "chain" && (
          <section className="tr-glass tv-page tv-chain">
            <OptionChain
              underlying={sel.underlying}
              spot={spot}
              expiries={isIndexFO(sel.underlying) ? optExpiries : []}
              expiry={chainExpiry}
              lot={spec?.lot ?? null}
              onExpiry={setChainExp}
              selected={sel}
              onSelect={(ref, side) => goTrade(ref, side)}
              disabled={!!blockedReason}
            />
          </section>
        )}

        {view === "pos" && (
          <section className="tr-glass tv-page">
            <div className="tv-head">
              <h2>Open positions</h2>
              <button className="tr-btn sm" onClick={squareAll} disabled={!accPositions.length || !active}>{confirmAll ? "Tap again to confirm" : "Exit all"}</button>
            </div>
            <div className="tr-scroll">
              <table>
                <thead><tr><th className="l">Instrument</th><th>Side</th><th>Qty</th><th>Avg</th><th>LTP</th><th>P&amp;L</th><th /></tr></thead>
                <tbody>
                  {data.loading && <tr><td colSpan={7} className="tr-empty">Loading positions…</td></tr>}
                  {!data.loading && !accPositions.length && <tr><td colSpan={7} className="tr-empty">No open positions. Use Trade or Option chain to place one.</td></tr>}
                  {accPositions.map((p) => {
                    const pl = positionPnl(p, spots), px = livePrice(p.instrument, spots);
                    return (
                      <tr key={p.id}>
                        <td className="l"><button className="tv-link" onClick={() => goTrade(parseInstrumentKey(p.instrument))}>{nameOfKey(p.instrument)}</button></td>
                        <td>{p.side}</td>
                        <td className="tr-mono">{p.qty}</td>
                        <td className="tr-mono">{num(p.avg_price)}</td>
                        <td className="tr-mono"><Px v={px ?? undefined} text={px == null ? "—" : num(px)} /></td>
                        <td className={"tr-mono " + (pl == null ? "" : pl >= 0 ? "tr-up" : "tr-down")}>{pl == null ? "—" : inr(pl)}</td>
                        <td><button className="tr-btn sm" disabled={!active} onClick={() => closePosition(p.instrument)}>Exit</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {view === "ord" && (
          <section className="tr-glass tv-page">
            <div className="tv-head"><h2>Orders</h2></div>
            <div className="tr-scroll">
              <table>
                <thead><tr><th className="l">Instrument</th><th>Side</th><th>Qty</th><th>Price</th><th>Type</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {!acctOrders.length && <tr><td colSpan={7} className="tr-empty">No orders yet.</td></tr>}
                  {acctOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="l">{nameOfKey(o.instrument)}</td>
                      <td>{o.side}</td>
                      <td className="tr-mono">{o.qty}</td>
                      <td className="tr-mono">{o.price == null ? "Market" : num(o.price)}</td>
                      <td>{o.order_type}</td>
                      <td title={o.reject_reason ?? undefined}>{o.status}</td>
                      <td>{o.status === "pending" && <button className="tr-btn sm" onClick={() => cancelOrder(o.id)}>Cancel</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {view === "pnl" && account && (
          <div className="tv-pnl">
            <section className="tr-glass tv-page">
              <div className="tv-head"><h2>Today</h2></div>
              <div className="tv-figs">
                <div><small>Day P&amp;L</small><b className={dayPl == null ? "" : dayPl >= 0 ? "tr-up" : "tr-down"}>{dayPl == null ? "—" : inr(dayPl)}</b></div>
                <div><small>Equity</small><b>{m ? inr(m.equity) : "—"}</b></div>
                <div><small>Balance</small><b>{inr(account.balance)}</b></div>
                <div><small>Open positions</small><b>{accPositions.length}</b></div>
              </div>
              <div className="tv-head"><h2>Recent trades</h2></div>
              <div className="tr-scroll">
                <table>
                  <thead><tr><th className="l">Time</th><th className="l">Instrument</th><th>Side</th><th>Qty</th><th>Price</th><th>Realised</th></tr></thead>
                  <tbody>
                    {!acctTrades.length && <tr><td colSpan={6} className="tr-empty">No trades yet.</td></tr>}
                    {acctTrades.slice(0, 40).map((t) => (
                      <tr key={t.id}>
                        <td className="l tr-mono" title={dateTime(t.executed_at)}>{timeOnly(t.executed_at)}</td>
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
            <div className="tv-rules">
              {m && <RulesPanel account={account} m={m} openCount={accPositions.length} />}
            </div>
          </div>
        )}

        <p className="tr-hint tr-foot">
          Simulated trading account. Stocks use {STOCK_LEVERAGE}× intraday leverage; futures and short options use a sample margin model.
        </p>
      </div>
      {toast.node}
    </Shell>
  );
}
