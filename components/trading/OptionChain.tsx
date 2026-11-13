"use client";
import { useMemo } from "react";
import type { InstrumentRef, Side } from "@/lib/types";
import { lotSize, optionGreeks, priceInstrument, strikeStep } from "@/lib/market/pricing";
import { num } from "./format";

interface Props {
  underlying: string;
  spot: number | null;
  expiries: string[];
  expiry: string;
  onExpiry: (e: string) => void;
  selected: InstrumentRef;
  onSelect: (ref: InstrumentRef, side?: Side) => void;
  disabled: boolean;
}

const dateLabel = (e: string) =>
  new Date(e + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** CE / PE chain around the at-the-money strike. Hover a premium for quick Buy / Sell; click it to load the contract. */
export default function OptionChain({ underlying, spot, expiries, expiry, onExpiry, selected, onSelect, disabled }: Props) {
  const step = strikeStep(underlying);
  const rows = useMemo(() => {
    if (spot == null || !expiry) return [];
    const atm = Math.round(spot / step) * step;
    return Array.from({ length: 17 }, (_, i) => {
      const k = atm + (i - 8) * step;
      const ce: InstrumentRef = { underlying, segment: "CE", strike: k, expiry };
      const pe: InstrumentRef = { underlying, segment: "PE", strike: k, expiry };
      const gc = optionGreeks(ce, spot), gp = optionGreeks(pe, spot);
      const iv = (v: number) => (v < 2 ? v * 100 : v).toFixed(1);
      return { k, atm: i === 8, ce, pe, cePx: priceInstrument(ce, spot), pePx: priceInstrument(pe, spot), ceIv: iv(gc.iv), peIv: iv(gp.iv), ceD: gc.delta, peD: gp.delta };
    });
  }, [underlying, spot, expiry, step]);

  const isSel = (r: InstrumentRef) => selected.segment === r.segment && selected.strike === r.strike && selected.expiry === r.expiry && selected.underlying === r.underlying;

  function cell(ref: InstrumentRef, px: number, cls: string, itm: boolean) {
    const quick = (side: Side) => (e: React.MouseEvent) => { e.stopPropagation(); if (!disabled) onSelect(ref, side); };
    return (
      <td
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
        {num(px)}
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
        <div className="tr-stat"><small>Lot size</small><div className="tr-mono">{lotSize(underlying)}</div></div>
      </div>
      <div className="tr-scroll tall">
        <table>
          <thead>
            <tr><th>IV</th><th>Δ</th><th>CE</th><th>Strike</th><th>PE</th><th>Δ</th><th>IV</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="tr-empty">Waiting for prices…</td></tr>}
            {rows.map((r) => {
              const ceItm = spot != null && r.k < spot, peItm = spot != null && r.k > spot;
              return (
                <tr key={r.k} className={r.atm ? "atm" : ""}>
                  <td className={"tr-muted tr-mono " + (ceItm ? "itm" : "")}>{r.ceIv}</td>
                  <td className={"tr-muted tr-mono " + (ceItm ? "itm" : "")}>{r.ceD.toFixed(2)}</td>
                  {cell(r.ce, r.cePx, "ce", ceItm)}
                  <td className="k">{r.k}</td>
                  {cell(r.pe, r.pePx, "pe", peItm)}
                  <td className={"tr-muted tr-mono " + (peItm ? "itm" : "")}>{r.peD.toFixed(2)}</td>
                  <td className={"tr-muted tr-mono " + (peItm ? "itm" : "")}>{r.peIv}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="tr-hint">Premiums, IV and delta come from the pricing model, not from exchange quotes. Hover a premium for quick Buy / Sell.</p>
    </>
  );
}
