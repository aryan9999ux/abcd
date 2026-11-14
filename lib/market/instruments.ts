import "server-only";
import { fetchInstrumentsCsv, kiteSession } from "./kite";
import { instrumentKey, type InstrumentRef } from "../types";
import { INDEX_SYMBOLS, type ContractSpec } from "./pricing";

/**
 * The exchange's own contract list, loaded from Zerodha: real expiries, lot sizes and strikes.
 * Nothing about contracts is hard-coded; when the list is not loaded, F&O trading is unavailable.
 */
export interface Inst {
  token: number;
  exchange: string;
  tradingsymbol: string;
  name: string;
  expiry: string; // YYYY-MM-DD or ""
  strike: number;
  lot: number;
  type: string; // CE | PE | FUT | EQ | INDEX
}

/** One CSV line, honouring double quotes. */
export function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const WANTED_NAMES = new Set(INDEX_SYMBOLS);
const STOCKS = new Set(["RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN"]);
const INDEX_ROWS: Record<string, string> = { "NIFTY 50": "NIFTY", "NIFTY BANK": "BANKNIFTY", SENSEX: "SENSEX" };

/** Parse a Kite instrument CSV into the rows this product uses. */
export function parseInstruments(csv: string, today: string): Inst[] {
  const lines = csv.split(/\r?\n/);
  const head = splitCsv(lines[0] ?? "");
  const ix = (n: string) => head.indexOf(n);
  const c = { tok: ix("instrument_token"), sym: ix("tradingsymbol"), name: ix("name"), exp: ix("expiry"), strike: ix("strike"), lot: ix("lot_size"), type: ix("instrument_type"), exch: ix("exchange"), seg: ix("segment") };
  if (Object.values(c).some((v) => v < 0)) throw new Error("Unexpected instrument list format.");
  const out: Inst[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const f = splitCsv(lines[i]);
    const type = f[c.type], name = f[c.name], sym = f[c.sym], exch = f[c.exch], seg = f[c.seg];
    const base = { token: Number(f[c.tok]), exchange: exch, tradingsymbol: sym, name, expiry: f[c.exp] || "", strike: Number(f[c.strike]) || 0, lot: Number(f[c.lot]) || 1 };
    if ((type === "FUT" || type === "CE" || type === "PE") && WANTED_NAMES.has(name) && base.expiry >= today) {
      out.push({ ...base, type });
    } else if (type === "EQ" && STOCKS.has(sym) && exch === "NSE") {
      out.push({ ...base, name: sym, type: "EQ" });
    } else if (seg === "INDICES" && INDEX_ROWS[sym]) {
      out.push({ ...base, name: INDEX_ROWS[sym], type: "INDEX" });
    }
  }
  return out;
}

interface Store {
  at: number;
  day: string;
  byKey: Map<string, Inst>; // our instrumentKey -> instrument
  spec: Record<string, ContractSpec>;
  strikes: Map<string, number[]>; // "NIFTY|2026-11-17" -> sorted strikes
  tokenOfSpot: Map<string, number>;
  loading?: Promise<void>;
  error?: string;
}
const g = globalThis as unknown as { __propInst?: Store };
const store: Store = (g.__propInst ??= { at: 0, day: "", byKey: new Map(), spec: {}, strikes: new Map(), tokenOfSpot: new Map() });

const istDay = (now = Date.now()) => new Date(now + 330 * 60000).toISOString().slice(0, 10);
const MAX_OPTION_EXPIRIES = 4;

function mode(nums: number[]): number {
  const m = new Map<number, number>();
  for (const n of nums) m.set(n, (m.get(n) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 1;
}

export function buildStore(rows: Inst[]): Pick<Store, "byKey" | "spec" | "strikes" | "tokenOfSpot"> {
  const byKey = new Map<string, Inst>();
  const strikes = new Map<string, number[]>();
  const tokenOfSpot = new Map<string, number>();
  const spec: Record<string, ContractSpec> = {};
  for (const r of rows) {
    if (r.type === "EQ" || r.type === "INDEX") { tokenOfSpot.set(r.name, r.token); continue; }
    const ref: InstrumentRef = { underlying: r.name, segment: r.type as "FUT" | "CE" | "PE", strike: r.type === "FUT" ? undefined : r.strike, expiry: r.expiry };
    byKey.set(instrumentKey(ref), r);
    if (r.type !== "FUT") {
      const k = `${r.name}|${r.expiry}`;
      const a = strikes.get(k) ?? [];
      if (!a.includes(r.strike)) a.push(r.strike);
      strikes.set(k, a);
    }
  }
  for (const a of strikes.values()) a.sort((x, y) => x - y);
  for (const u of INDEX_SYMBOLS) {
    const mine = rows.filter((r) => r.name === u && r.type !== "EQ" && r.type !== "INDEX");
    if (!mine.length) continue;
    const futExpiries = [...new Set(mine.filter((r) => r.type === "FUT").map((r) => r.expiry))].sort();
    const optExpiries = [...new Set(mine.filter((r) => r.type !== "FUT").map((r) => r.expiry))].sort().slice(0, MAX_OPTION_EXPIRIES);
    const near = strikes.get(`${u}|${optExpiries[0]}`) ?? [];
    const diffs = near.slice(1).map((s, i) => s - near[i]).filter((d) => d > 0);
    spec[u] = { lot: mine[0].lot, strikeStep: mode(diffs), futExpiries, optExpiries };
  }
  return { byKey, spec, strikes, tokenOfSpot };
}

async function load(): Promise<void> {
  const today = istDay();
  const [nfo, bfo, nse, bse] = await Promise.all(["NFO", "BFO", "NSE", "BSE"].map((e) => fetchInstrumentsCsv(e as "NFO")));
  const rows = [...parseInstruments(nfo, today), ...parseInstruments(bfo, today), ...parseInstruments(nse, today), ...parseInstruments(bse, today)];
  Object.assign(store, buildStore(rows), { at: Date.now(), day: today, error: undefined });
}

/** Load (once a day) the contract list. Needs the admin's Zerodha session. Never throws; check `contractsReady`. */
export async function ensureInstruments(): Promise<void> {
  if (store.day === istDay() && store.byKey.size) return;
  if (!kiteSession()) return;
  store.loading ??= load()
    .catch((e) => { store.error = e instanceof Error ? e.message : String(e); })
    .finally(() => { store.loading = undefined; });
  await store.loading;
}

export const contractsReady = () => store.day === istDay() && store.byKey.size > 0;
export const contractsError = () => store.error ?? null;
export const forgetInstruments = () => { store.day = ""; };

export function specOf(u: string): ContractSpec | undefined { return store.spec[u]; }
export function allSpecs(): Record<string, ContractSpec> { return store.spec; }
export function instOf(ref: InstrumentRef): Inst | undefined { return store.byKey.get(instrumentKey(ref)); }
export function strikesOf(u: string, expiry: string): number[] { return store.strikes.get(`${u}|${expiry}`) ?? []; }
export function spotToken(u: string): number | undefined { return store.tokenOfSpot.get(u); }
/** "NFO:NIFTY2611724500CE" for the quote endpoint. */
export function quoteKeyOf(ref: InstrumentRef): string | undefined {
  const i = instOf(ref);
  return i ? `${i.exchange}:${i.tradingsymbol}` : undefined;
}
