import "server-only";
import { createHash } from "node:crypto";

/**
 * Zerodha Kite Connect helpers (server only).
 *
 * Login flow: admin opens kite.zerodha.com/connect/login -> Zerodha redirects to our callback with a
 * one-time request_token -> we exchange it (checksum = sha256(api_key + request_token + api_secret))
 * for an access_token. The token expires around 06:00 IST the next morning, so the admin logs in daily.
 * The token lives in process memory only. A server restart means one more click on the admin page.
 */
const BASE = process.env.KITE_BASE_URL || "https://api.kite.trade"; // override is for pointing tests at a local stand-in only
const IST_MS = 5.5 * 3600_000;

export interface KiteSession {
  accessToken: string;
  userId: string;
  userName: string;
  connectedAt: number;
}
interface KiteState { session?: KiteSession; lastError?: string; lastOkAt?: number }
const g = globalThis as unknown as { __kite?: KiteState };
const state: KiteState = (g.__kite ??= {});

export const kiteConfigured = () => !!process.env.KITE_API_KEY && !!process.env.KITE_API_SECRET;

export function loginUrl(): string {
  return `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(process.env.KITE_API_KEY ?? "")}`;
}

/** Next 06:00 IST after the moment the token was issued. */
export function sessionExpiry(connectedAt: number): number {
  const ist = new Date(connectedAt + IST_MS);
  let six = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 6, 0, 0);
  if (ist.getTime() >= six) six += 24 * 3600_000;
  return six - IST_MS;
}

export function kiteSession(): KiteSession | undefined {
  const s = state.session;
  if (s && Date.now() >= sessionExpiry(s.connectedAt)) {
    state.session = undefined;
    state.lastError = "Zerodha session expired. Connect again.";
    return undefined;
  }
  return s;
}

export const kiteStatus = () => ({
  configured: kiteConfigured(),
  session: kiteSession(),
  expiresAt: state.session ? sessionExpiry(state.session.connectedAt) : null,
  lastError: state.lastError ?? null,
  lastOkAt: state.lastOkAt ?? null,
});

export function noteOk() {
  state.lastOkAt = Date.now();
  state.lastError = undefined;
}
export function noteError(msg: string) {
  state.lastError = msg;
}

export async function exchangeRequestToken(requestToken: string): Promise<KiteSession> {
  const key = process.env.KITE_API_KEY;
  const secret = process.env.KITE_API_SECRET;
  if (!key || !secret) throw new Error("KITE_API_KEY and KITE_API_SECRET are not set.");
  const checksum = createHash("sha256").update(key + requestToken + secret).digest("hex");
  const res = await fetch(`${BASE}/session/token`, {
    method: "POST",
    headers: { "X-Kite-Version": "3", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ api_key: key, request_token: requestToken, checksum }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: Record<string, string> } | null;
  if (!res.ok || json?.status !== "success" || !json.data?.access_token) {
    throw new Error(json?.message || `Zerodha answered with status ${res.status}.`);
  }
  const session: KiteSession = {
    accessToken: json.data.access_token,
    userId: json.data.user_id ?? "",
    userName: json.data.user_name ?? json.data.user_id ?? "Zerodha user",
    connectedAt: Date.now(),
  };
  state.session = session;
  state.lastError = undefined;
  return session;
}

/** Our symbol -> Kite "EXCHANGE:TRADINGSYMBOL" key used by the quote endpoints. */
const INDEX_KEYS: Record<string, string> = { NIFTY: "NSE:NIFTY 50", BANKNIFTY: "NSE:NIFTY BANK", SENSEX: "BSE:SENSEX" };
export const kiteKey = (symbol: string) => INDEX_KEYS[symbol] ?? `NSE:${symbol}`;

async function kiteGet(path: string): Promise<Response> {
  const s = kiteSession();
  if (!s) throw new Error("Not connected to Zerodha.");
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Kite-Version": "3", Authorization: `token ${process.env.KITE_API_KEY}:${s.accessToken}` },
    cache: "no-store",
  });
  if (res.status === 403) state.session = undefined; // token no longer valid
  return res;
}

async function kiteJson<T>(path: string): Promise<T> {
  const res = await kiteGet(path);
  const json = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: T } | null;
  if (!res.ok || json?.status !== "success" || json.data === undefined) {
    throw new Error(json?.message || `Zerodha answered with status ${res.status}.`);
  }
  return json.data;
}

export interface KiteQuote {
  last_price?: number;
  oi?: number;
  volume?: number;
  depth?: { buy?: { price: number; quantity: number }[]; sell?: { price: number; quantity: number }[] };
}

/** Full quotes (last price, open interest, best bid and ask) for up to 500 "EXCHANGE:SYMBOL" keys in one call. */
export async function fetchQuotes(keys: string[]): Promise<Record<string, KiteQuote>> {
  if (!keys.length) return {};
  const qs = keys.slice(0, 500).map((k) => `i=${encodeURIComponent(k)}`).join("&");
  return kiteJson<Record<string, KiteQuote>>(`/quote?${qs}`);
}

/** The instrument master for one exchange, as CSV text. */
export async function fetchInstrumentsCsv(exchange: "NFO" | "BFO" | "NSE" | "BSE"): Promise<string> {
  const res = await kiteGet(`/instruments/${exchange}`);
  if (!res.ok) throw new Error(`Zerodha instrument list ${exchange} answered with status ${res.status}.`);
  return res.text();
}

export type KiteInterval = "minute" | "5minute" | "15minute";

/** Real historical candles: [timestamp, open, high, low, close, volume]. */
export async function fetchCandles(token: number, interval: KiteInterval, from: string, to: string) {
  const q = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&oi=0`;
  const d = await kiteJson<{ candles: [string, number, number, number, number, number][] }>(`/instruments/historical/${token}/${interval}?${q}`);
  return d.candles;
}

export function dropSession(reason: string) {
  state.session = undefined;
  state.lastError = reason;
}
