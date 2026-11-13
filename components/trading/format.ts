import { parseInstrumentKey, type InstrumentRef } from "@/lib/types";

export const inr = (n: number) => (n < 0 ? "-" : "") + "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");

export const num = (n: number, d = 2) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

export const pct = (n: number, d = 2) => (n >= 0 ? "+" : "") + n.toFixed(d) + "%";

const shortDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function nameOf(ref: InstrumentRef): string {
  if (ref.segment === "EQ") return ref.underlying;
  const e = ref.expiry ? shortDate(ref.expiry) : "";
  return ref.segment === "FUT"
    ? `${ref.underlying} FUT ${e}`
    : `${ref.underlying} ${ref.strike} ${ref.segment} ${e}`;
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
