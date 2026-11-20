import { labelOf } from "./constants";
import { parseInstrumentKey, type InstrumentRef } from "@/lib/types";

/** Rupees, exact: paise are shown whenever there are any (₹16,507.50), whole rupees stay clean (₹5,00,000). */
export const inr = (n: number) => {
  const a = Math.abs(n), cents = Math.round(a * 100) / 100;
  const whole = Math.abs(cents - Math.round(cents)) < 0.005;
  return (n < 0 && cents > 0 ? "-" : "") + "₹" + cents.toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
};

export const num = (n: number, d = 2) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

export const pct = (n: number, d = 2) => (n >= 0 ? "+" : "") + n.toFixed(d) + "%";

const shortDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function nameOf(ref: InstrumentRef): string {
  const u = labelOf(ref.underlying);
  if (ref.segment === "EQ") return u;
  const e = ref.expiry ? shortDate(ref.expiry) : "";
  return ref.segment === "FUT"
    ? `${u} Fut ${e}`
    : `${u} ${ref.strike} ${ref.segment} ${e}`;
}

export const nameOfKey = (key: string) => nameOf(parseInstrumentKey(key));

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export const timeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour12: false });

export const phaseLabel = (p: string) =>
  p === "phase_1" ? "Phase 1" : p === "phase_2" ? "Phase 2" : "Funded";

export const statusLabel = (s: string) =>
  s === "active" ? "Active" : s === "passed" ? "Passed" : s === "breached" ? "Breached" : "Closed";
