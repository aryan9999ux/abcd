"use client";
import { useEffect, useState } from "react";
import type { ChainRow, InstrumentRef, Side } from "@/lib/types";
import { num } from "./format";

interface Props {
  underlying: string;
  spot: number | null;
  expiries: string[];
  expiry: string;
  lot: number | null;
  onExpiry: (e: string) => void;
  selected: InstrumentRef;
  onSelect: (ref: InstrumentRef, side?: Side) => void;
  disabled: boolean;
}

const dateLabel = (e: string) =>
  new Date(e + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Real chain from the exchange, refreshed about once a second while the tab is visible. */
function useChain(underlying: string, expiry: string) {
  const [rows, setRows] = useState<ChainRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    if (!underlying || !expiry) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    setRows([]);
    setState("loading");
    async function load() {
      if (stop) return;
      if (!document.hidden) {
        try {
          const res = await fetch(`/api/chain?underlying=${underlying}&expiry=${expiry}`, { cache: "no-store" });
          const j = (await res.json()) as { ok: boolean; ready?: boolean; rows?: ChainRow[] };
          if (!stop && j.ok) { setRows(j.rows ?? []); setState(j.ready ? "ready" : "loading"); }
          else if (!stop) setState("error");
        } catch { if (!stop) setState("error"); }
      }
      if (!stop) timer = setTimeout(load, 1100);
    }
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, [underlying, expiry]);
  return { rows, state };
}

const fixed = (v: number | null, d: number) => (v == null ? "—" : v.toFixed(d));

/** CE / PE chain around the at-the-money strike. Hover a premium for quick Buy / Sell; click it to load the contract. */
export default function OptionChain({ underlying, spot, expiries, expiry, lot, onExpiry, selected, onSelect, disabled }: Props) {
  const { rows, state } = useChain(expiries.length ? underlying : "", expiry);

  const isSel = (r: InstrumentRef) => selected.segment === r.segment && selected.strike === r.strike && selected.expiry === r.expiry && selected.underlying === r.underlying;

  function cell(ref: InstrumentRef, px: number | null, cls: string, itm: boolean, title: string) {
    const quick = (side: Side) => (e: React.MouseEvent) => { e.stopPropagation(); if (!disabled) onSelect(ref, side); };
    return (
      <td
        title={title}
        className={`cell ${cls} ${itm ? "itm" : ""} ${isSel(ref) ? "sel" : ""}`}
        tabIndex={0}
        onClick={() => onSelect(ref)}
        onKeyDown={(e) => { if (e.key === "Enter") onSelect(ref); }}
      >
        {cls === "ce" && (
          <span className="bs">
            <button className="b" onClick={quick("Buy")} aria-label={`Buy ${ref.strike} call`}>B</button>
            <button className="s" onClick={quick("Sell")} aria-label={`Sell ${ref.strike} call`}>S</button>
          </span>
        )}
        {px == null ? "—" : num(px)}
        {cls === "pe" && (
          <span className="bs">
            <button className="b" onClick={quick("Buy")} aria-label={`Buy ${ref.strike} put`}>B</button>
            <button className="s" onClick={quick("Sell")} aria-label={`Sell ${ref.strike} put`}>S</button>
          </span>
        )}
      </td>
    );
  }

  if (!expiries.length) {
    return <div className="tr-empty">Stocks trade in the cash segment. Pick Nifty, Bank Nifty or Sensex for the option chain.</div>;
  }

  return (
    <>
      <div className="tr-chainhead">
        <label className="tr-f">
          Expiry
          <select value={expiry} onChange={(e) => onExpiry(e.target.value)}>
            {expiries.map((e) => <option key={e} value={e}>{dateLabel(e)}</option>)}
          </select>
        </label>
        <div className="tr-stat"><small>Spot</small><div className="tr-mono">{spot == null ? "—" : num(spot)}</div></div>
        <div className="tr-stat"><small>Lot size</small><div className="tr-mono">{lot ?? "—"}</div></div>
      </div>
      <div className="tr-scroll tall">
        <table>
          <thead>
            <tr><th>IV</th><th>Δ</th><th>CE</th><th>Strike</th><th>PE</th><th>Δ</th><th>IV</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="tr-empty">{state === "error" ? "Could not load the chain. Retrying…" : "Loading the live chain from the exchange…"}</td></tr>}
            {rows.map((r) => {
              const ceItm = spot != null && r.strike < spot, peItm = spot != null && r.strike > spot;
              const ce: InstrumentRef = { underlying, segment: "CE", strike: r.strike, expiry };
              const pe: InstrumentRef = { underlying, segment: "PE", strike: r.strike, expiry };
              const tip = (x: ChainRow["ce"]) => `Bid ${x.bid ?? "—"} · Ask ${x.ask ?? "—"} · OI ${x.oi == null ? "—" : x.oi.toLocaleString("en-IN")}`;
              return (
                <tr key={r.strike} className={r.atm ? "atm" : ""}>
                  <td className={"tr-muted tr-mono " + (ceItm ? "itm" : "")}>{fixed(r.ce.iv, 1)}</td>
                  <td className={"tr-muted tr-mono " + (ceItm ? "itm" : "")}>{fixed(r.ce.delta, 2)}</td>
                  {cell(ce, r.ce.ltp, "ce", ceItm, tip(r.ce))}
                  <td className="k">{r.strike}</td>
                  {cell(pe, r.pe.ltp, "pe", peItm, tip(r.pe))}
                  <td className={"tr-muted tr-mono " + (peItm ? "itm" : "")}>{fixed(r.pe.delta, 2)}</td>
                  <td className={"tr-muted tr-mono " + (peItm ? "itm" : "")}>{fixed(r.pe.iv, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="tr-hint">Premiums are live exchange prices (hover for bid, ask and open interest). IV and delta are calculated from those premiums. Click a premium to trade it.</p>
    </>
  );
}
