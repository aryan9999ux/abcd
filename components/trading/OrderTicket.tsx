"use client";
import { Spin } from "@/components/ui/Spin";
import type { InstrumentRef, OrderType, Side } from "@/lib/types";
import { marginRequired } from "@/lib/market/pricing";
import { STOCK_LEVERAGE } from "./constants";
import { inr, nameOf, num } from "./format";

export interface TicketState {
  side: Side;
  type: OrderType;
  qty: string;
  price: string;
  stopLoss: string;
  /** Super order: entry (Market or Limit) with a stop loss and a target placed together. */
  super: boolean;
  target: string;
}

interface Props {
  inst: InstrumentRef;
  /** Real lot size of the contract (1 for cash stocks). */
  lot: number;
  ltp: number | null;
  spot: number | null;
  state: TicketState;
  onChange: (s: TicketState) => void;
  available: number | null;
  disabledReason: string | null;
  busy: boolean;
  message: { text: string; err: boolean } | null;
  onSubmit: () => void;
  /** How many no-stop-loss warnings this account has already used. */
  slUsed?: number;
}

/** Units for the ticket quantity: lots * lot size for F&O, shares for stocks. */
export function ticketUnits(inst: InstrumentRef, qty: string, lot: number): number {
  const q = Math.max(0, Math.floor(Number(qty)) || 0);
  return inst.segment === "EQ" ? q : q * lot;
}

export default function OrderTicket({ inst, lot, ltp, spot, state, onChange, available, disabledReason, busy, message, onSubmit, slUsed = 0 }: Props) {
  const fo = inst.segment !== "EQ";
  const units = ticketUnits(inst, state.qty, lot);
  const limit = Number(state.price);
  const px = state.type === "Market" ? ltp : limit > 0 ? limit : ltp;
  const margin = px != null && spot != null && units > 0 ? marginRequired(inst, state.side, units, px, spot) : null;
  const needsPrice = state.type !== "Market";
  const stop = Number(state.stopLoss);
  const tgt = Number(state.target);
  const buy = state.side === "Buy";
  const superBad =
    !state.super ? null :
    !(stop > 0) || !(tgt > 0) ? "Enter both a stop loss and a target." :
    px != null && (buy ? !(stop < px && tgt > px) : !(stop > px && tgt < px))
      ? (buy ? "Stop loss must be below the price and the target above it." : "Stop loss must be above the price and the target below it.") : null;
  const invalid =
    units <= 0 ? "Enter a quantity of 1 or more." :
    needsPrice && !(limit > 0) ? "Enter a price for this order." :
    ltp == null ? "Waiting for prices." : superBad;
  const risk = px != null && stop > 0 && units > 0 ? Math.abs(px - stop) * units : null;
  const reward = state.super && px != null && tgt > 0 && units > 0 ? Math.abs(tgt - px) * units : null;
  const tab = state.super ? "Super" : state.type;
  const blocked = disabledReason ?? invalid;
  const set = (patch: Partial<TicketState>) => onChange({ ...state, ...patch });

  return (
    <div className="tr-glass tr-ticket" data-side={state.side}>
      <div className="tr-ohead">
        <div><b>{state.side === "Buy" ? "BUY" : "SELL"}</b> <span>{nameOf(inst)}</span></div>
        <div className="tr-mono">{ltp == null ? "—" : num(ltp)}</div>
      </div>
      <div className="tr-obody">
      <div className="tr-prod"><span>Intraday</span><span className="tr-muted">{fo ? "F&O · NRML margin" : `Cash · ${STOCK_LEVERAGE}× leverage`}</span></div>
      <div className="tr-segs two" role="group" aria-label="Side">
        {(["Buy", "Sell"] as Side[]).map((s) => (
          <button key={s} aria-pressed={state.side === s} onClick={() => set({ side: s })}>{s}</button>
        ))}
      </div>
      <div className="tr-segs three" role="group" aria-label="Order type">
        {(["Market", "Limit", "Super"] as const).map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => {
            if (t === "Super") set({ super: true });
            else set({ super: false, type: t, price: t === "Limit" && !state.price && ltp != null ? ltp.toFixed(2) : state.price });
          }}>{t}</button>
        ))}
      </div>
      {state.super && (
        <div className="tr-superbar">
          <span>Entry at</span>
          <div className="tr-segs two mini" role="group" aria-label="Entry type">
            {(["Market", "Limit"] as OrderType[]).map((t) => (
              <button key={t} aria-pressed={state.type === t} onClick={() => set({ type: t, price: t === "Limit" && !state.price && ltp != null ? ltp.toFixed(2) : state.price })}>{t}</button>
            ))}
          </div>
        </div>
      )}
      <label className="tr-f">
        {fo ? `Lots (1 lot = ${lot})` : "Shares"}
        <input type="number" min={1} step={1} value={state.qty} onChange={(e) => set({ qty: e.target.value })} />
      </label>
      {needsPrice && (
        <label className="tr-f">
          Limit price
          <input type="number" step={0.05} value={state.price} onChange={(e) => set({ price: e.target.value })} />
        </label>
      )}
      <label className="tr-f">
        {state.super ? "Stop loss price" : "Stop loss price (optional)"}
        <input type="number" step={0.05} value={state.stopLoss} placeholder={buy ? "Below your buy price" : "Above your sell price"} onChange={(e) => set({ stopLoss: e.target.value })} />
      </label>
      {state.super && (
        <label className="tr-f">
          Target price
          <input type="number" step={0.05} value={state.target} placeholder={buy ? "Above your buy price" : "Below your sell price"} onChange={(e) => set({ target: e.target.value })} />
        </label>
      )}
      <div className="tr-ln"><span className="tr-muted">Risk at stop</span><span className="tr-mono">{risk == null ? "—" : inr(risk)}</span></div>
      {state.super && <div className="tr-ln"><span className="tr-muted">Reward at target</span><span className="tr-mono">{reward == null ? "—" : `${inr(reward)}${risk ? ` · 1:${(reward / risk).toFixed(1)}` : ""}`}</span></div>}
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
        {busy ? <><Spin />Placing…</> : `${state.side} ${nameOf(inst)}`}
      </button>
      <p className={"tr-msg" + (message?.err ? " err" : "")} role="status">{disabledReason ?? message?.text ?? ""}</p>
      </div>
    </div>
  );
}
