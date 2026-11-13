"use client";
import type { InstrumentRef, OrderType, Side } from "@/lib/types";
import { lotSize, marginRequired } from "@/lib/market/pricing";
import { STOCK_LEVERAGE } from "./constants";
import { inr, nameOf, num } from "./format";

export interface TicketState {
  side: Side;
  type: OrderType;
  qty: string;
  price: string;
  stopLoss: string;
}

interface Props {
  inst: InstrumentRef;
  ltp: number | null;
  spot: number | null;
  state: TicketState;
  onChange: (s: TicketState) => void;
  available: number | null;
  disabledReason: string | null;
  busy: boolean;
  message: { text: string; err: boolean } | null;
  onSubmit: () => void;
}

/** Units for the ticket quantity: lots * lot size for F&O, shares for stocks. */
export function ticketUnits(inst: InstrumentRef, qty: string): number {
  const q = Math.max(0, Math.floor(Number(qty)) || 0);
  return inst.segment === "EQ" ? q : q * lotSize(inst.underlying);
}

export default function OrderTicket({ inst, ltp, spot, state, onChange, available, disabledReason, busy, message, onSubmit }: Props) {
  const fo = inst.segment !== "EQ";
  const units = ticketUnits(inst, state.qty);
  const limit = Number(state.price);
  const px = state.type === "Market" ? ltp : limit > 0 ? limit : ltp;
  const margin = px != null && spot != null && units > 0 ? marginRequired(inst, state.side, units, px, spot) : null;
  const needsPrice = state.type !== "Market";
  const invalid =
    units <= 0 ? "Enter a quantity of 1 or more." :
    needsPrice && !(limit > 0) ? "Enter a price for this order." :
    ltp == null ? "Waiting for prices." : null;
  const stop = Number(state.stopLoss);
  const risk = px != null && stop > 0 && units > 0 ? Math.abs(px - stop) * units : null;
  const blocked = disabledReason ?? invalid;
  const set = (patch: Partial<TicketState>) => onChange({ ...state, ...patch });

  return (
    <div className="tr-glass tr-card tr-ticket">
      <h3>Order ticket</h3>
      <div>
        <div style={{ font: "600 .95rem var(--f-display)" }}>{nameOf(inst)}</div>
        <div className="tr-muted tr-mono" style={{ fontSize: ".78rem" }}>LTP {ltp == null ? "—" : num(ltp)}</div>
      </div>
      <div className="tr-segs two" role="group" aria-label="Side">
        {(["Buy", "Sell"] as Side[]).map((s) => (
          <button key={s} aria-pressed={state.side === s} onClick={() => set({ side: s })}>{s}</button>
        ))}
      </div>
      <div className="tr-segs three" role="group" aria-label="Order type">
        {(["Market", "Limit", "Stop"] as OrderType[]).map((t) => (
          <button key={t} aria-pressed={state.type === t} onClick={() => set({ type: t, price: t !== "Market" && !state.price && ltp != null ? ltp.toFixed(2) : state.price })}>{t}</button>
        ))}
      </div>
      <label className="tr-f">
        {fo ? `Lots (1 lot = ${lotSize(inst.underlying)})` : "Shares"}
        <input type="number" min={1} step={1} value={state.qty} onChange={(e) => set({ qty: e.target.value })} />
      </label>
      {needsPrice && (
        <label className="tr-f">
          {state.type === "Limit" ? "Limit price" : "Stop price"}
          <input type="number" step={0.05} value={state.price} onChange={(e) => set({ price: e.target.value })} />
        </label>
      )}
      <label className="tr-f">
        Stop loss price (required to open a trade)
        <input type="number" step={0.05} value={state.stopLoss} placeholder={state.side === "Buy" ? "Below your buy price" : "Above your sell price"} onChange={(e) => set({ stopLoss: e.target.value })} />
      </label>
      <div className="tr-ln"><span className="tr-muted">Risk at stop</span><span className="tr-mono">{risk == null ? "—" : inr(risk)}</span></div>
      <div className="tr-ln"><span className="tr-muted">Quantity</span><span className="tr-mono">{units.toLocaleString("en-IN")}</span></div>
      <div className="tr-ln"><span className="tr-muted">Order value</span><span className="tr-mono">{px == null ? "—" : inr(units * px)}</span></div>
      <div className="tr-ln">
        <span className="tr-muted">Margin required</span>
        <span className="tr-mono">{margin == null ? "—" : inr(margin)}{inst.segment === "EQ" ? ` (${STOCK_LEVERAGE}×)` : ""}</span>
      </div>
      <div className="tr-ln"><span className="tr-muted">Available</span><span className="tr-mono">{available == null ? "—" : inr(available)}</span></div>
      <button
        className={"tr-btn lg " + (state.side === "Buy" ? "buy" : "sell")}
        disabled={busy || !!blocked}
        onClick={onSubmit}
        title={blocked ?? undefined}
      >
        {busy ? "Placing…" : `${state.side} ${nameOf(inst)}`}
      </button>
      <p className={"tr-msg" + (message?.err ? " err" : "")} role="status">{disabledReason ?? message?.text ?? ""}</p>
    </div>
  );
}
