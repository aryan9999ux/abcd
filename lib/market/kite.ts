import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { adminClient } from "../supabase/admin";

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
  await persistSession(session);
  return session;
}

/* The token is kept (encrypted) in the database so a redeploy or restart does not drop live prices.
   It is still only valid until about 06:00 IST, so the admin connects once each trading morning. */
const encKey = () => createHash("sha256").update("kite-session|" + (process.env.KITE_API_SECRET ?? "")).digest();

function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}
function unseal(b64: string): string {
  const raw = Buffer.from(b64, "base64");
  const d = createDecipheriv("aes-256-gcm", encKey(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

async function persistSession(s: KiteSession) {
  try {
    const { error } = await adminClient().from("kite_session").upsert({
      id: 1, token_enc: seal(s.accessToken), user_id: s.userId, user_name: s.userName, connected_at: new Date(s.connectedAt).toISOString(),
    });
    if (error) console.error("[kite] could not save session:", error.message);
  } catch (e) {
    console.error("[kite] could not save session:", e instanceof Error ? e.message : e);
  }
}

let lastRestore = 0;
/** After a restart, pick the saved login back up if it is still valid. Cheap; retries at most every 20 seconds. */
export async function restoreSession(): Promise<void> {
  if (state.session || Date.now() - lastRestore < 20_000) return;
  lastRestore = Date.now();
  try {
    const { data } = await adminClient().from("kite_session").select("token_enc,user_id,user_name,connected_at").eq("id", 1).maybeSingle();
    if (!data) return;
    const connectedAt = Date.parse(data.connected_at);
    if (Date.now() >= sessionExpiry(connectedAt)) return;
    state.session = { accessToken: unseal(data.token_enc), userId: data.user_id ?? "", userName: data.user_name ?? "Zerodha user", connectedAt };
    state.lastError = undefined;
  } catch (e) {
    console.error("[kite] could not restore session:", e instanceof Error ? e.message : e);
  }
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
