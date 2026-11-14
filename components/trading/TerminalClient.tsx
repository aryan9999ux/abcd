"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { instrumentKey, parseInstrumentKey, type InstrumentRef, type Side } from "@/lib/types";
import { priceOf } from "@/lib/market/pricing";
import { marketOpen } from "@/lib/engine/pure";
import { orderTypeAt, postJSON } from "./api";
import { mergeLive, pushTick } from "./candles";
import ChartPanel from "./ChartPanel";
import { SYMBOLS, WATCHLIST, isIndexFO } from "./constants";
import { dateTime, inr, nameOf, nameOfKey, num, phaseLabel, statusLabel, timeOnly } from "./format";
import { Meter } from "./Meter";
import { accountMetrics, livePrice, positionPnl } from "./metrics";
import NoAccounts from "./NoAccounts";
import OptionChain from "./OptionChain";
import StatusStrip from "./StatusStrip";
import OrderTicket, { ticketUnits, type TicketState } from "./OrderTicket";
import Shell from "./Shell";
import type { AccountRow, Candle, PlanRow } from "./types";
import { useContracts } from "./useContracts";
import { useQuotes } from "./useQuotes";
import { useToast } from "./useToast";
import { useTraderData } from "./useTraderData";

interface Props {
  initialAccounts: AccountRow[];
  plans: PlanRow[];
  initialAccountId: string | null;
}

type Tab = "pos" | "ord" | "his";

export default function TerminalClient({ initialAccounts, plans, initialAccountId }: Props) {
  const [accountId, setAccountId] = useState<string | null>(initialAccountId);
  const data = useTraderData(initialAccounts, accountId);
  const contracts = useContracts();
  const toast = useToast();

  const [sel, setSel] = useState<InstrumentRef>({ underlying: "NIFTY", segment: "FUT" });
  const [chainExp, setChainExp] = useState("");
  const [ticket, setTicket] = useState<TicketState>({ side: "Buy", type: "Market", qty: "1", price: "", stopLoss: "" });
  const [tf, setTf] = useState(1);
  const [tab, setTab] = useState<Tab>("pos");
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
  const { quotes: spots, source, error: quoteError } = useQuotes(SYMBOLS, contractKeys);

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
    return <Shell active="terminal"><NoAccounts what="trading terminal" /></Shell>;
  }

  const slot = (
    <label className="tr-f tr-acctsel">
      <select value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value)} aria-label="Trading account">
        {data.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {plans.find((p) => p.key === a.plan_key)?.name ?? a.plan_key} · {inr(a.account_size)} · {phaseLabel(a.phase)}{a.status !== "active" ? ` · ${statusLabel(a.status)}` : ""}
          </option>
        ))}
      </select>
    </label>
  );

  const optExpiries = spec?.optExpiries ?? [];
  const chainExpiry = optExpiries.includes(chainExp) ? chainExp : optExpiries[0] ?? "";
  const acctOrders = data.orders.filter((o) => o.account_id === accountId).slice(0, 30);
  const noPrices = Object.keys(spots).length === 0;

  return (
    <Shell active="terminal" accountId={accountId} slot={slot}>
      {account?.status === "breached" && (
        <div className="tr-banner bad" role="alert">
          <b>Account closed.</b> {account.breach_reason ?? "A loss limit was reached."} Open positions were squared off.
          <Link className="tr-btn sm" href="/checkout">Buy a new account</Link>
        </div>
      )}
      {account?.status === "passed" && (
        <div className="tr-banner ok"><b>Phase passed.</b> This account no longer accepts new orders.<Link className="tr-btn sm" href="/dashboard">Go to dashboard</Link></div>
      )}
      {(quoteError || data.error) && <div className="tr-banner" role="status">{quoteError ?? data.error}</div>}

      {account && <StatusStrip account={account} m={m} openCount={accPositions.length} />}

      <div className="tr-grid">
        <div className="tr-col">
          <div className="tr-glass tr-card">
            <h3>Watchlist {source === "demo" && <span className="tr-pill">Dev demo</span>}</h3>
            <div className="tr-wl">
              <div className="tr-sep">Index F&amp;O</div>
              {WATCHLIST.map((w, i) => (
                <div key={w.k}>
                  {i === 3 && <div className="tr-sep">Stocks · {5}× intraday</div>}
                  <button aria-pressed={sel.underlying === w.k} onClick={() => pickUnderlying(w.k)}>
                    <span><b>{w.k}</b><small>{w.fo ? `Lot ${contracts.specs[w.k]?.lot ?? "—"}` : "Cash"}</small></span>
                    <span className="px">{spots[w.k] == null ? "—" : num(spots[w.k])}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
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
        </div>

        <div className="tr-col">
          <div className="tr-glass tr-chart">
            <div className="tr-chead">
              <div>
                <div className="t">{nameOf(sel)}</div>
                <div className="tr-mono" style={{ fontSize: ".9rem" }}>{ltp == null ? "—" : num(ltp)}</div>
              </div>
            </div>
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

          <div className="tr-glass tr-card">
            <div className="tr-tabs" role="tablist">
              <button className="tab" role="tab" aria-selected={tab === "pos"} onClick={() => setTab("pos")}>Positions{accPositions.length ? ` (${accPositions.length})` : ""}</button>
              <button className="tab" role="tab" aria-selected={tab === "ord"} onClick={() => setTab("ord")}>Orders</button>
              <button className="tab" role="tab" aria-selected={tab === "his"} onClick={() => setTab("his")}>Trades</button>
              <span className="tr-sp" />
              <button className="tr-btn sm" onClick={squareAll} disabled={!accPositions.length || account?.status !== "active"}>
                {confirmAll ? "Confirm square off" : "Square off all"}
              </button>
            </div>
            <div className="tr-scroll">
              {tab === "pos" && (
                <table>
                  <thead><tr><th className="l">Instrument</th><th>Side</th><th>Qty</th><th>Avg</th><th>LTP</th><th>P&amp;L</th><th /></tr></thead>
                  <tbody>
                    {data.loading && <tr><td colSpan={7} className="tr-empty">Loading positions…</td></tr>}
                    {!data.loading && !accPositions.length && <tr><td colSpan={7} className="tr-empty">No open positions. Click the chart or the option chain to place a trade.</td></tr>}
                    {accPositions.map((p) => {
                      const pl = positionPnl(p, spots), px = livePrice(p.instrument, spots);
                      return (
                        <tr key={p.id}>
                          <td className="l"><button className="tr-btn sm" onClick={() => pick(parseInstrumentKey(p.instrument))} style={{ border: 0, background: "none", padding: 0 }}>{nameOfKey(p.instrument)}</button></td>
                          <td>{p.side}</td>
                          <td className="tr-mono">{p.qty}</td>
                          <td className="tr-mono">{num(p.avg_price)}</td>
                          <td className="tr-mono">{px == null ? "—" : num(px)}</td>
                          <td className={"tr-mono " + (pl == null ? "" : pl >= 0 ? "tr-up" : "tr-down")}>{pl == null ? "—" : inr(pl)}</td>
                          <td><button className="tr-btn sm" disabled={account?.status !== "active"} onClick={() => closePosition(p.instrument)}>Exit</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {tab === "ord" && (
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
              )}
              {tab === "his" && (
                <table>
                  <thead><tr><th className="l">Time</th><th className="l">Instrument</th><th>Side</th><th>Qty</th><th>Price</th><th>Realised</th></tr></thead>
                  <tbody>
                    {!data.trades.length && <tr><td colSpan={6} className="tr-empty">No trades yet.</td></tr>}
                    {data.trades.slice(0, 30).map((t) => (
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
              )}
            </div>
          </div>
        </div>

        <div className="tr-col tr-chaincol">
          <div className="tr-glass tr-chain">
            <div className="tr-card" style={{ padding: 0 }}><h3>Option chain <span className="tr-pill">{sel.underlying}</span></h3></div>
            <OptionChain
              underlying={sel.underlying}
              spot={spot}
              expiries={isIndexFO(sel.underlying) ? optExpiries : []}
              expiry={chainExpiry}
              lot={spec?.lot ?? null}
              onExpiry={setChainExp}
              selected={sel}
              onSelect={(ref, side) => pick(ref, side)}
              disabled={!!blockedReason}
            />
          </div>
        </div>
      </div>
      <p className="tr-hint" style={{ marginTop: 14 }}>
        Simulated trading account. Stocks use {5}× intraday leverage; futures and short options use a sample margin model. Prices are for the simulated account only.
      </p>
      {toast.node}
    </Shell>
  );
}
