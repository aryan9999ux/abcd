"use client";
import { labelOf } from "./constants";
import type { InstrumentRef } from "@/lib/types";
import { num } from "./format";
import type { Hit } from "./useContractSearch";

const dmy = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Matching option contracts under a search box. Picking one selects it exactly like choosing it from the option chain. */
export default function SearchResults({ hits, busy, ready, onPick, q }: { hits: Hit[]; busy: boolean; ready: boolean; q: string; onPick: (ref: InstrumentRef) => void }) {
  if (!/\d|\b(ce|pe|call|put)\b/i.test(q)) return null;
  return (
    <div className="tr-sres" role="listbox" aria-label="Matching contracts">
      {!ready && <p className="tr-sres-note">Contracts are loading from the exchange. Try again in a moment.</p>}
      {ready && !hits.length && <p className="tr-sres-note">{busy ? "Searching…" : "No contract found. Try a strike and CE or PE, like 25700 PE."}</p>}
      {hits.map((h) => (
        <button key={h.key} role="option" aria-selected="false" className="tr-sres-row" onClick={() => onPick({ underlying: h.underlying, segment: h.segment, strike: h.strike ?? undefined, expiry: h.expiry })}>
          <span><b>{labelOf(h.underlying)} {h.strike} {h.segment}</b><small>Expiry {dmy(h.expiry)} · Lot {h.lot}</small></span>
          <span className="tr-mono">{h.ltp == null ? "—" : num(h.ltp)}</span>
        </button>
      ))}
    </div>
  );
}
