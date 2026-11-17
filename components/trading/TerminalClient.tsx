"use client";
import { LogoMark } from "@/components/brand/Logo";
import Px from "./Px";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { RiskPanel } from "./StatusStrip";
import RulesPanel from "./RulesPanel";
import OrderTicket, { ticketUnits, type TicketState } from "./OrderTicket";
import Shell from "./Shell";
import "./trading.css";
import "./dk.css";
import "./dx.css";
import { useMedia } from "./useMedia";
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

type Screen = "home" | "watch" | "chain" | "ord" | "pos" | "acct" | "inst";

export default function TerminalClient({ initialAccounts, plans, initialAccountId, fromPrice }: Props) {
  const [accountId, setAccountId] = useState<string | null>(initialAccountId);
  const data = useTraderData(initialAccounts, accountId);
  const contracts = useContracts();
  const toast = useToast();
  const router = useRouter();
  useEffect(() => {
    try { const t = localStorage.getItem("theme"); if (t === "dark" || t === "light") document.documentElement.dataset.theme = t; } catch { /* storage blocked */ }
  }, []);

  const [sel, setSel] = useState<InstrumentRef>({ underlying: "NIFTY", segment: "FUT" });
  const [chainExp, setChainExp] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [backTo, setBackTo] = useState<Screen>("watch");
  const [sheet, setSheet] = useState(false);
  const desk = useMedia("(min-width: 1000px)");
  const [centre, setCentre] = useState<"chart" | "chain">("chart");
  const [dock, setDock] = useState<"pos" | "ord" | "his" | "rules">("pos");
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
    void sendOrder(ticket.side, units, ticket.type, ticket.type === "Market" ? undefined : price).then((ok) => { if (ok) setSheet(false); });
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

  function toggleTheme() {
    const r = document.documentElement;
    const next = (r.dataset.theme || "dark") === "dark" ? "light" : "dark";
    r.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* storage blocked */ }
  }
  async function signOut() {
    await browserClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const optExpiries = spec?.optExpiries ?? [];
  const chainExpiry = optExpiries.includes(chainExp) ? chainExp : optExpiries[0] ?? "";
  const acctOrders = data.orders.filter((o) => o.account_id === accountId).slice(0, 40);
  const acctTrades = data.trades.filter((t) => t.account_id === accountId);
  const noPrices = Object.keys(spots).length === 0;
  const pendingCount = data.orders.filter((o) => o.account_id === accountId && o.status === "pending").length;
  const active = account?.status === "active";
  const dayPl = m && account ? m.equity - account.day_start_equity : null;
  const openPl = accPositions.reduce((t, p) => t + (positionPnl(p, spots) ?? 0), 0);
  const demoLeft = account?.is_demo && account.demo_expires_at ? Math.max(0, new Date(account.demo_expires_at).getTime() - Date.now()) : null;
  const demoText = demoLeft == null ? "" : demoLeft > 86_400_000 ? `${Math.ceil(demoLeft / 86_400_000)} days left` : `${Math.max(1, Math.ceil(demoLeft / 3_600_000))} hours left`;
  const open = marketOpen(Date.now());
  const chg = (k: string) => { const px = spots[k], pv = prev[k]; return px != null && pv != null && pv ? { px, d: px - pv, pc: ((px - pv) / pv) * 100 } : null; };
  const movers = WATCHLIST.filter((w) => !w.fo).map((w) => ({ w, c: chg(w.k) })).filter((x) => x.c).sort((a, b) => Math.abs(b.c!.pc) - Math.abs(a.c!.pc)).slice(0, 4);
  const ql = (u: string) => { setSel({ underlying: u, segment: "FUT", expiry: contracts.specs[u]?.futExpiries[0] }); setScreen("chain"); };

  const openInst = (ref: InstrumentRef, from: Screen, side?: Side) => { pick(ref, side); setBackTo(from); setScreen("inst"); };
  const trade = (side: Side) => { setTicket((t) => ({ ...t, side })); setSheet(true); };
  const fromChain = (ref: InstrumentRef, side?: Side) => { pick(ref, side); setBackTo("chain"); setSheet(true); };

  const nav: [Screen, string, ReactNode, string?][] = [
    ["home", "Home", <path key="a" d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />],
    ["watch", "Watchlist", <path key="a" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />],
    ["chain", "Options", <path key="a" d="M4 6h16M4 12h16M4 18h16M9 3v18M15 3v18" />],
    ["ord", "Orders", <path key="a" d="M6 4h12v16H6zM9 9h6M9 13h6M9 17h3" />, pendingCount ? String(pendingCount) : undefined],
    ["pos", "Positions", <path key="a" d="M3 17l5-6 4 4 8-9M15 6h5v5" />, accPositions.length ? String(accPositions.length) : undefined],
  ];
  const current = screen === "inst" ? "Trade" : screen === "acct" ? "Account" : nav.find((n) => n[0] === screen)?.[1] ?? "";
  const plName = plans.find((p) => p.key === account?.plan_key)?.name ?? account?.plan_key ?? "";

  const priceCell = (k: string) => { const c = chg(k); return (
    <span className="px"><Px v={c?.px} text={c ? num(c.px) : "—"} className="pxv" /><small className={c ? (c.d >= 0 ? "tr-up" : "tr-down") : ""}>{c ? `${c.d >= 0 ? "+" : ""}${c.pc.toFixed(2)}%` : "—"}</small></span>
  ); };

  const sendBar = (
    <div className="dk-buy">
      <button className="s" disabled={!!blockedReason} onClick={() => trade("Sell")}>Sell</button>
      <button className="b" disabled={!!blockedReason} onClick={() => trade("Buy")}>Buy</button>
    </div>
  );

  const mobileUI = (
    <div className="dk tr">
      <header className="dk-top">
        {screen === "inst" ? (
          <button className="dk-ico" onClick={() => setScreen(backTo)} aria-label="Back">‹</button>
        ) : (
          <Link className="dk-exit" href="/dashboard" aria-label="Leave terminal">‹ Exit</Link>
        )}
        <h1>{current}</h1>
        <span className="dk-sp" />
        <span className={"dk-mkt " + (open ? "on" : "")}>{open ? "Market open" : "Market closed"}</span>
        <button className="dk-ico me" onClick={() => setScreen("acct")} aria-label="Account and more">{plName.slice(0, 1) || "A"}</button>
      </header>

      <div className="dk-body">
        <nav className="dk-nav" aria-label="Terminal">
          <Link className="dk-brand" href="/dashboard" aria-label="Leave terminal">‹ Exit</Link>
          {nav.map(([k, label, icon, badge]) => (
            <button key={k} aria-current={screen === k || (screen === "inst" && backTo === k) ? "page" : undefined} onClick={() => (k === "chain" && !isIndexFO(sel.underlying) ? ql("NIFTY") : setScreen(k))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
              <span>{label}</span>{badge && <i>{badge}</i>}
            </button>
          ))}
          <button className="dk-more" aria-current={screen === "acct" ? "page" : undefined} onClick={() => setScreen("acct")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>
            <span>Account</span>
          </button>
        </nav>

        <main className="dk-main">
          {account?.is_demo && account.status === "active" && (screen === "home" || screen === "acct") && (
            <div className="dk-note"><span><b>Demo account.</b> Same rules as the real plan, no payouts. {demoText}.</span><Link href="/checkout">Get a real account</Link></div>
          )}
          {account?.status === "breached" && <div className="dk-note bad" role="alert"><span><b>Account closed.</b> {account.breach_reason ?? "A loss limit was reached."} Open positions were squared off.</span><span style={{ display: "flex", gap: 14 }}><Link href={`/accounts/${account.id}`}>See why</Link><Link href="/checkout">New account</Link></span></div>}
          {account?.status === "passed" && <div className="dk-note ok"><span><b>Phase passed.</b> This account no longer takes orders.</span><Link href="/dashboard">Dashboard</Link></div>}
          {account?.status === "closed" && account.is_demo && <div className="dk-note"><span><b>Demo ended.</b> Pick a plan to keep trading.</span><Link href="/checkout">Choose a plan</Link></div>}
          {(quoteError || data.error) && <div className="dk-note" role="status"><span>{quoteError ?? data.error}</span></div>}

          {screen === "home" && account && (
            <div className="dk-stack">
              <section className="dk-hero">
                <small>Account value</small>
                <b className="dk-big">{m ? inr(m.equity) : "—"}</b>
                <span className={"dk-delta " + (dayPl == null ? "" : dayPl >= 0 ? "tr-up" : "tr-down")}>{dayPl == null ? "—" : `${dayPl >= 0 ? "+" : ""}${inr(dayPl)}`} today</span>
                <div className="dk-trio">
                  <div><small>Available</small><b>{m ? inr(m.available) : "—"}</b></div>
                  <div><small>Margin used</small><b>{m ? inr(m.marginUsed) : "—"}</b></div>
                  <div><small>Open P&amp;L</small><b className={openPl >= 0 ? "tr-up" : "tr-down"}>{inr(openPl)}</b></div>
                </div>
              </section>
              <div className="dk-idx">
                {["NIFTY", "BANKNIFTY", "SENSEX"].map((k) => { const c = chg(k); return (
                  <button key={k} onClick={() => openInst({ underlying: k, segment: "FUT", expiry: contracts.specs[k]?.futExpiries[0] }, "home")}>
                    <small>{k}</small><Px v={c?.px} className="tr-mono" text={c ? num(c.px) : "—"} />
                    <span className={"tr-mono " + (c ? (c.d >= 0 ? "tr-up" : "tr-down") : "")}>{c ? `${c.d >= 0 ? "▲" : "▼"} ${Math.abs(c.pc).toFixed(2)}%` : "—"}</span>
                  </button>
                ); })}
              </div>
              <section className="dk-card">
                <div className="dk-h"><h2>Quick actions</h2></div>
                <div className="dk-quick">
                  <button onClick={() => ql("NIFTY")}>Nifty options</button>
                  <button onClick={() => ql("BANKNIFTY")}>Bank Nifty options</button>
                  <button onClick={() => setScreen("watch")}>Watchlist</button>
                  <button onClick={() => setScreen("acct")}>My rules</button>
                </div>
              </section>
              <RiskPanel account={account} m={m} openCount={accPositions.length} />
              <section className="dk-card">
                <div className="dk-h"><h2>Open positions</h2><button className="dk-link" onClick={() => setScreen("pos")}>See all</button></div>
                {!accPositions.length ? <p className="dk-empty">No open positions. Pick a symbol from the watchlist to trade.</p> : accPositions.slice(0, 3).map((p) => { const pl = positionPnl(p, spots); return (
                  <button key={p.id} className="dk-row" onClick={() => openInst(parseInstrumentKey(p.instrument), "home")}>
                    <span><b>{nameOfKey(p.instrument)}</b><small>{p.side} · {p.qty} @ {num(p.avg_price)}</small></span>
                    <b className={"tr-mono " + (pl == null ? "" : pl >= 0 ? "tr-up" : "tr-down")}>{pl == null ? "—" : inr(pl)}</b>
                  </button>
                ); })}
              </section>
              {movers.length > 0 && (
                <section className="dk-card">
                  <div className="dk-h"><h2>Biggest movers</h2></div>
                  {movers.map(({ w }) => (
                    <button key={w.k} className="dk-row" onClick={() => openInst({ underlying: w.k, segment: "EQ" }, "home")}>
                      <span><b>{w.k}</b><small>{w.n}</small></span>{priceCell(w.k)}
                    </button>
                  ))}
                </section>
              )}
            </div>
          )}

          {screen === "watch" && (
            <div className="dk-stack">
              <input className="dk-search" placeholder="Search symbol" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search symbols" />
              <section className="dk-card flush">
                {WATCHLIST.filter((w) => w.k.toLowerCase().includes(q.trim().toLowerCase()) || w.n.toLowerCase().includes(q.trim().toLowerCase())).map((w, i, arr) => (
                  <div key={w.k}>
                    {(i === 0 || arr[i - 1].fo !== w.fo) && <div className="dk-sep">{w.fo ? "Index futures and options" : `Stocks · ${STOCK_LEVERAGE}× intraday`}</div>}
                    <button className="dk-row" onClick={() => openInst(w.fo ? { underlying: w.k, segment: "FUT", expiry: contracts.specs[w.k]?.futExpiries[0] } : { underlying: w.k, segment: "EQ" }, "watch")}>
                      <span><b>{w.k}</b><small>{w.fo ? `Lot ${contracts.specs[w.k]?.lot ?? "—"}` : w.n}</small></span>{priceCell(w.k)}
                    </button>
                  </div>
                ))}
              </section>
            </div>
          )}

          {screen === "inst" && (
            <div className="dk-inst">
              <section className="dk-card dk-chartcard">
                <div className="dk-qh">
                  <div><b>{nameOf(sel)}</b>{source === "demo" && <span className="tr-pill">Sample prices</span>}</div>
                  <div className="dk-q"><span className="tr-mono">{ltp == null ? "—" : num(ltp)}</span>{selChg != null && selPrev != null && <small className={selChg >= 0 ? "tr-up" : "tr-down"}>{selChg >= 0 ? "+" : ""}{num(selChg)} ({((selChg / selPrev) * 100).toFixed(2)}%)</small>}</div>
                </div>
                <div className="dk-chart">
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
              {curPos && (
                <section className="dk-card dk-cur">
                  <span><small>Your position</small><b>{curPos.side} {curPos.qty} @ {num(curPos.avg_price)}</b></span>
                  <button className="tr-btn sm" disabled={!active} onClick={() => closePosition(curPos.instrument)}>Exit</button>
                </section>
              )}
              {sel.underlying && isIndexFO(sel.underlying) && <button className="dk-wide" onClick={() => setScreen("chain")}>Open {sel.underlying} option chain</button>}
              {sendBar}
            </div>
          )}

          {screen === "chain" && (
            <section className="dk-card flush dk-chainwrap">
              <OptionChain
                underlying={sel.underlying}
                spot={spot}
                expiries={isIndexFO(sel.underlying) ? optExpiries : []}
                expiry={chainExpiry}
                lot={spec?.lot ?? null}
                onExpiry={setChainExp}
                selected={sel}
                onSelect={(ref, side) => fromChain(ref, side)}
                disabled={!!blockedReason}
              />
              <div className="dk-tabs">
                {["NIFTY", "BANKNIFTY", "SENSEX"].map((u) => <button key={u} aria-pressed={sel.underlying === u} onClick={() => ql(u)}>{u}</button>)}
              </div>
            </section>
          )}

          {screen === "ord" && (
            <div className="dk-stack">
              {!acctOrders.length && <p className="dk-empty big">No orders yet. Orders you place will show up here.</p>}
              {acctOrders.map((o) => (
                <div key={o.id} className="dk-order">
                  <span className={"dk-side " + (o.side === "Buy" ? "b" : "s")}>{o.side}</span>
                  <span className="dk-grow"><b>{nameOfKey(o.instrument)}</b><small>{o.order_type} · {o.qty} @ {o.price == null ? "market" : num(o.price)} · {timeOnly(o.created_at)}</small>{o.reject_reason && <small className="tr-down">{o.reject_reason}</small>}</span>
                  <span className={"dk-st " + o.status}>{o.status}</span>
                  {o.status === "pending" && <button className="tr-btn sm" onClick={() => cancelOrder(o.id)}>Cancel</button>}
                </div>
              ))}
            </div>
          )}

          {screen === "pos" && (
            <div className="dk-stack">
              <section className="dk-hero slim">
                <small>Open P&amp;L</small>
                <b className={"dk-big " + (openPl >= 0 ? "tr-up" : "tr-down")}>{inr(openPl)}</b>
                <button className="tr-btn sm" onClick={squareAll} disabled={!accPositions.length || !active}>{confirmAll ? "Tap again to confirm" : "Exit all"}</button>
              </section>
              {data.loading && <p className="dk-empty">Loading positions…</p>}
              {!data.loading && !accPositions.length && <p className="dk-empty big">No open positions. Use the watchlist or option chain to place a trade.</p>}
              {accPositions.map((p) => { const pl = positionPnl(p, spots), px = livePrice(p.instrument, spots); return (
                <div key={p.id} className="dk-pos">
                  <button className="dk-posmain" onClick={() => openInst(parseInstrumentKey(p.instrument), "pos")}>
                    <span className="dk-grow"><b>{nameOfKey(p.instrument)}</b><small>{p.side} · {p.qty} @ {num(p.avg_price)} · LTP {px == null ? "—" : num(px)}</small></span>
                    <b className={"tr-mono " + (pl == null ? "" : pl >= 0 ? "tr-up" : "tr-down")}>{pl == null ? "—" : inr(pl)}</b>
                  </button>
                  <button className="tr-btn sm" disabled={!active} onClick={() => closePosition(p.instrument)}>Exit</button>
                </div>
              ); })}
            </div>
          )}

          {screen === "acct" && account && (
            <div className="dk-stack">
              <section className="dk-card">
                <div className="dk-h"><h2>Trading account</h2></div>
                <label className="tr-f"><select value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value)} aria-label="Trading account">
                  {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.is_demo ? "Demo · " : ""}{plans.find((p) => p.key === a.plan_key)?.name ?? a.plan_key} · {inr(a.account_size)} · {phaseLabel(a.phase)}{a.status !== "active" ? ` · ${statusLabel(a.status)}` : ""}</option>)}
                </select></label>
                <div className="dk-trio">
                  <div><small>Balance</small><b>{inr(account.balance)}</b></div>
                  <div><small>Equity</small><b>{m ? inr(m.equity) : "—"}</b></div>
                  <div><small>Day P&amp;L</small><b className={dayPl == null ? "" : dayPl >= 0 ? "tr-up" : "tr-down"}>{dayPl == null ? "—" : inr(dayPl)}</b></div>
                </div>
              </section>
              {m && <RulesPanel account={account} m={m} openCount={accPositions.length} />}
              <section className="dk-card flush">
                <div className="dk-h pad"><h2>Recent trades</h2></div>
                {!acctTrades.length && <p className="dk-empty">No trades yet.</p>}
                {acctTrades.slice(0, 30).map((t) => (
                  <div key={t.id} className="dk-row static">
                    <span><b>{nameOfKey(t.instrument)}</b><small>{t.side} · {t.qty} @ {num(t.price)} · {timeOnly(t.executed_at)}</small></span>
                    <b className={"tr-mono " + (t.realized_pnl >= 0 ? "tr-up" : "tr-down")}>{t.realized_pnl === 0 ? "—" : inr(t.realized_pnl)}</b>
                  </div>
                ))}
              </section>
              <section className="dk-card flush">
                <Link className="dk-row" href="/dashboard"><span><b>Dashboard</b><small>Progress, payouts and all your accounts</small></span><span>›</span></Link>
                <Link className="dk-row" href="/checkout"><span><b>Buy a new account</b><small>Plans and sizes</small></span><span>›</span></Link>
                <button className="dk-row" onClick={toggleTheme}><span><b>Switch theme</b><small>Light or dark</small></span><span>›</span></button>
                <button className="dk-row" onClick={signOut}><span><b>Sign out</b></span><span>›</span></button>
              </section>
              <p className="dk-fine">Simulated trading account. Stocks use {STOCK_LEVERAGE}× intraday leverage; futures and short options use a sample margin model.</p>
            </div>
          )}
        </main>
      </div>

      {sheet && (
        <div className="dk-sheetwrap" onClick={() => setSheet(false)}>
          <div className="dk-sheet" role="dialog" aria-label="Place order" onClick={(e) => e.stopPropagation()}>
            <button className="dk-x" onClick={() => setSheet(false)} aria-label="Close">×</button>
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
        </div>
      )}
      {toast.node}
    </div>
  );

  const wl = WATCHLIST.filter((w) => w.k.toLowerCase().includes(q.trim().toLowerCase()) || w.n.toLowerCase().includes(q.trim().toLowerCase()));
  const selSpec = isIndexFO(sel.underlying);
  const desktopUI = (
    <div className="dx tr">
      <header className="dx-top">
        <Link className="dx-back" href="/dashboard" aria-label="Back to portal">‹ Portal</Link>
        <span className="dx-logo"><LogoMark size={26} id="tx" /></span>
        <div className="dx-idx">
          {["NIFTY", "BANKNIFTY", "SENSEX"].map((k) => { const c = chg(k); return (
            <button key={k} onClick={() => { pickUnderlying(k); setCentre("chart"); }}>
              <small>{k}</small><Px v={c?.px} className="tr-mono" text={c ? num(c.px) : "—"} />
              <span className={"tr-mono " + (c ? (c.d >= 0 ? "tr-up" : "tr-down") : "")}>{c ? `${c.d >= 0 ? "+" : ""}${c.pc.toFixed(2)}%` : ""}</span>
            </button>
          ); })}
        </div>
        <span className="dx-sp" />
        <span className={"dx-mkt " + (open ? "on" : "")}>{open ? "Market open" : "Market closed"}</span>
        {account && (
          <label className="dx-acct">
            <span><small>{account.is_demo ? "Demo account" : "Account"}</small><b>{m ? inr(m.equity) : "—"}</b></span>
            <select value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value)} aria-label="Trading account">
              {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.is_demo ? "Demo · " : ""}{plans.find((p) => p.key === a.plan_key)?.name ?? a.plan_key} · {inr(a.account_size)}{a.status !== "active" ? ` · ${statusLabel(a.status)}` : ""}</option>)}
            </select>
          </label>
        )}
        <button className="dx-ico" onClick={toggleTheme} aria-label="Switch theme" title="Theme"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg></button>
      </header>

      {(account?.is_demo && account.status === "active") || account?.status === "breached" || account?.status === "passed" || account?.status === "closed" || quoteError || data.error ? (
        <div className="dx-notes">
          {account?.is_demo && account.status === "active" && <div className="dx-note"><span><b>Demo account.</b> Same rules as the real plan, no payouts. {demoText}.</span><Link href="/checkout">Get a real account</Link></div>}
          {account?.status === "breached" && <div className="dx-note bad" role="alert"><span><b>Account closed.</b> {account.breach_reason ?? "A loss limit was reached."} Open positions were squared off.</span><span style={{ display: "flex", gap: 14 }}><Link href={`/accounts/${account.id}`}>See why</Link><Link href="/checkout">New account</Link></span></div>}
          {account?.status === "passed" && <div className="dx-note ok"><span><b>Phase passed.</b> This account no longer takes orders.</span><Link href="/dashboard">Portal</Link></div>}
          {account?.status === "closed" && account.is_demo && <div className="dx-note"><span><b>Demo ended.</b> Pick a plan to keep trading.</span><Link href="/checkout">Choose a plan</Link></div>}
          {(quoteError || data.error) && <div className="dx-note" role="status"><span>{quoteError ?? data.error}</span></div>}
        </div>
      ) : null}

      <div className="dx-grid">
        <aside className="dx-panel dx-wl" aria-label="Watchlist">
          <div className="dx-ph"><h2>Watchlist</h2>{source === "demo" && <span className="dx-tag">Sample prices</span>}</div>
          <input className="dx-search" placeholder="Search symbol" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search symbols" />
          <div className="dx-wlist">
            {wl.map((w, i) => { const c = chg(w.k); return (
              <div key={w.k}>
                {(i === 0 || wl[i - 1].fo !== w.fo) && <div className="dx-sep">{w.fo ? "Index F&O" : `Stocks · ${STOCK_LEVERAGE}× intraday`}</div>}
                <div className="dx-wrow" aria-current={sel.underlying === w.k}>
                  <button className="main" onClick={() => { pickUnderlying(w.k); setCentre("chart"); }}>
                    <span><b>{w.k}</b><small>{w.fo ? `Lot ${contracts.specs[w.k]?.lot ?? "—"}` : w.n}</small></span>
                    <span className="px"><Px v={c?.px} text={c ? num(c.px) : "—"} className="pxv" /><small className={c ? (c.d >= 0 ? "tr-up" : "tr-down") : ""}>{c ? `${c.d >= 0 ? "+" : ""}${c.pc.toFixed(2)}%` : "—"}</small></span>
                  </button>
                  <span className="acts"><button className="b" onClick={() => { pickUnderlying(w.k); setTicket((t) => ({ ...t, side: "Buy" })); }} aria-label={`Buy ${w.k}`}>B</button><button className="s" onClick={() => { pickUnderlying(w.k); setTicket((t) => ({ ...t, side: "Sell" })); }} aria-label={`Sell ${w.k}`}>S</button></span>
                </div>
              </div>
            ); })}
          </div>
        </aside>

        <section className="dx-panel dx-centre">
          <div className="dx-ih">
            <div className="dx-in"><h1>{nameOf(sel)}</h1><small>{fo ? `Lot ${lot ?? "—"}${sel.expiry ? ` · Expiry ${new Date(sel.expiry + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}` : "NSE · Cash"}</small></div>
            <div className="dx-iq"><span className="tr-mono">{ltp == null ? "—" : num(ltp)}</span>{selChg != null && selPrev != null && <small className={"tr-mono " + (selChg >= 0 ? "tr-up" : "tr-down")}>{selChg >= 0 ? "+" : ""}{num(selChg)} ({((selChg / selPrev) * 100).toFixed(2)}%)</small>}</div>
            <div className="dx-tabs" role="tablist">
              <button role="tab" aria-selected={centre === "chart"} onClick={() => setCentre("chart")}>Chart</button>
              <button role="tab" aria-selected={centre === "chain"} onClick={() => { if (!selSpec) pickUnderlying("NIFTY"); setCentre("chain"); }}>Option chain</button>
            </div>
          </div>
          <div className="dx-cbody tr-cbody">
            {centre === "chart" ? (
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
            ) : (
              <OptionChain
                underlying={selSpec ? sel.underlying : "NIFTY"}
                spot={spot}
                expiries={optExpiries}
                expiry={chainExpiry}
                lot={spec?.lot ?? null}
                onExpiry={setChainExp}
                selected={sel}
                onSelect={(ref, side) => pick(ref, side)}
                disabled={!!blockedReason}
              />
            )}
          </div>
        </section>

        <aside className="dx-right">
          <OrderTicket inst={sel} lot={lot ?? 1} ltp={ltp} spot={spot} state={ticket} onChange={setTicket} available={m ? m.available : null} disabledReason={blockedReason} busy={busy} message={msg} onSubmit={submitTicket} />
          {account && (
            <div className="dx-panel dx-fund">
              <div className="dx-ph"><h2>Funds</h2></div>
              <div className="dx-kv"><span>Available margin</span><b>{m ? inr(m.available) : "—"}</b></div>
              <div className="dx-kv"><span>Margin used</span><b>{m ? inr(m.marginUsed) : "—"}</b></div>
              <div className="dx-kv"><span>Day P&amp;L</span><b className={dayPl == null ? "" : dayPl >= 0 ? "tr-up" : "tr-down"}>{dayPl == null ? "—" : `${dayPl >= 0 ? "+" : ""}${inr(dayPl)}`}</b></div>
              <div className="dx-kv"><span>Open P&amp;L</span><b className={openPl >= 0 ? "tr-up" : "tr-down"}>{inr(openPl)}</b></div>
            </div>
          )}
        </aside>

        <section className="dx-panel dx-dock">
          <div className="dx-dtabs" role="tablist">
            <button role="tab" aria-selected={dock === "pos"} onClick={() => setDock("pos")}>Positions{accPositions.length ? <i>{accPositions.length}</i> : null}</button>
            <button role="tab" aria-selected={dock === "ord"} onClick={() => setDock("ord")}>Orders{pendingCount ? <i>{pendingCount}</i> : null}</button>
            <button role="tab" aria-selected={dock === "his"} onClick={() => setDock("his")}>Trades</button>
            <button role="tab" aria-selected={dock === "rules"} onClick={() => setDock("rules")}>Rules and limits</button>
            <span className="dx-sp" />
            {dock === "pos" && <><span className={"dx-total " + (openPl >= 0 ? "tr-up" : "tr-down")}>Open P&amp;L {inr(openPl)}</span><button className="dx-btn" onClick={squareAll} disabled={!accPositions.length || !active}>{confirmAll ? "Click again to confirm" : "Exit all"}</button></>}
          </div>
          <div className="dx-dbody">
            {dock === "pos" && (
              <table><thead><tr><th className="l">Instrument</th><th>Side</th><th>Qty</th><th>Avg price</th><th>LTP</th><th>P&amp;L</th><th /></tr></thead><tbody>
                {data.loading && <tr><td colSpan={7} className="dx-empty">Loading positions…</td></tr>}
                {!data.loading && !accPositions.length && <tr><td colSpan={7} className="dx-empty">No open positions. Pick a symbol on the left, or click the chart, to place a trade.</td></tr>}
                {accPositions.map((p) => { const pl = positionPnl(p, spots), px = livePrice(p.instrument, spots); return (
                  <tr key={p.id}><td className="l"><button className="dx-lnk" onClick={() => pick(parseInstrumentKey(p.instrument))}>{nameOfKey(p.instrument)}</button></td>
                    <td><span className={"dx-side " + (p.side === "Buy" ? "b" : "s")}>{p.side}</span></td><td className="tr-mono">{p.qty}</td><td className="tr-mono">{num(p.avg_price)}</td>
                    <td className="tr-mono"><Px v={px ?? undefined} text={px == null ? "—" : num(px)} /></td>
                    <td className={"tr-mono " + (pl == null ? "" : pl >= 0 ? "tr-up" : "tr-down")}>{pl == null ? "—" : inr(pl)}</td>
                    <td><button className="dx-btn sm" disabled={!active} onClick={() => closePosition(p.instrument)}>Exit</button></td></tr>
                ); })}
              </tbody></table>
            )}
            {dock === "ord" && (
              <table><thead><tr><th className="l">Instrument</th><th>Side</th><th>Type</th><th>Qty</th><th>Price</th><th>Status</th><th /></tr></thead><tbody>
                {!acctOrders.length && <tr><td colSpan={7} className="dx-empty">No orders yet.</td></tr>}
                {acctOrders.map((o) => (
                  <tr key={o.id}><td className="l">{nameOfKey(o.instrument)}</td><td><span className={"dx-side " + (o.side === "Buy" ? "b" : "s")}>{o.side}</span></td><td>{o.order_type}</td><td className="tr-mono">{o.qty}</td>
                    <td className="tr-mono">{o.price == null ? "Market" : num(o.price)}</td><td title={o.reject_reason ?? undefined}><span className={"dk-st " + o.status}>{o.status}</span></td>
                    <td>{o.status === "pending" && <button className="dx-btn sm" onClick={() => cancelOrder(o.id)}>Cancel</button>}</td></tr>
                ))}
              </tbody></table>
            )}
            {dock === "his" && (
              <table><thead><tr><th className="l">Time</th><th className="l">Instrument</th><th>Side</th><th>Qty</th><th>Price</th><th>Realised</th></tr></thead><tbody>
                {!acctTrades.length && <tr><td colSpan={6} className="dx-empty">No trades yet.</td></tr>}
                {acctTrades.slice(0, 40).map((t) => (
                  <tr key={t.id}><td className="l tr-mono" title={dateTime(t.executed_at)}>{timeOnly(t.executed_at)}</td><td className="l">{nameOfKey(t.instrument)}</td><td><span className={"dx-side " + (t.side === "Buy" ? "b" : "s")}>{t.side}</span></td>
                    <td className="tr-mono">{t.qty}</td><td className="tr-mono">{num(t.price)}</td><td className={"tr-mono " + (t.realized_pnl >= 0 ? "tr-up" : "tr-down")}>{t.realized_pnl === 0 ? "—" : inr(t.realized_pnl)}</td></tr>
                ))}
              </tbody></table>
            )}
            {dock === "rules" && account && m && (
              <div className="dx-rules"><RiskPanel account={account} m={m} openCount={accPositions.length} /><RulesPanel account={account} m={m} openCount={accPositions.length} /></div>
            )}
          </div>
        </section>
      </div>
      {toast.node}
    </div>
  );

  if (desk === null) return <div className="dk tr" />;
  return desk ? desktopUI : mobileUI;
}
