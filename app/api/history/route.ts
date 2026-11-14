import { requireUser } from "@/lib/engine/auth";
import { HttpError, run } from "@/lib/engine/http";
import { kick } from "@/lib/engine/runtime";
import { fetchCandles, type KiteInterval } from "@/lib/market/kite";
import { ensureInstruments, instOf, spotToken } from "@/lib/market/instruments";
import { ALL_SYMBOLS } from "@/lib/market/pricing";
import type { Candle, InstrumentRef } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TF: Record<string, { interval: KiteInterval; days: number }> = {
  "1": { interval: "minute", days: 5 },
  "5": { interval: "5minute", days: 12 },
  "15": { interval: "15minute", days: 30 },
};
const ist = (ms: number) => new Date(ms + 330 * 60000).toISOString().slice(0, 19).replace("T", " ");
const cache = new Map<string, { at: number; candles: Candle[] }>();

/** Real exchange candles for the chart (Zerodha historical data). Live prices are added on top in the browser. */
export function GET(req: Request) {
  return run(async () => {
    await requireUser();
    kick();
    const q = new URL(req.url).searchParams;
    const underlying = (q.get("underlying") ?? "").toUpperCase();
    const segment = q.get("segment") as InstrumentRef["segment"];
    const tf = TF[q.get("tf") ?? "1"];
    if (!ALL_SYMBOLS.includes(underlying) || !["EQ", "FUT", "CE", "PE"].includes(segment) || !tf) throw new HttpError(400, "Bad chart request.");
    const ref: InstrumentRef = { underlying, segment, strike: q.get("strike") ? Number(q.get("strike")) : undefined, expiry: q.get("expiry") || undefined };
    await ensureInstruments();
    const token = segment === "EQ" ? spotToken(underlying) : instOf(ref)?.token;
    if (!token) return { candles: [] as Candle[], available: false };
    const ck = `${token}|${tf.interval}`;
    const hit = cache.get(ck);
    if (hit && Date.now() - hit.at < 15_000) return { candles: hit.candles, available: true };
    const now = Date.now();
    let rows;
    try {
      rows = await fetchCandles(token, tf.interval, ist(now - tf.days * 86_400_000), ist(now));
    } catch (e) {
      throw new HttpError(502, e instanceof Error ? e.message : "Chart history is not available right now.");
    }
    const candles: Candle[] = rows.slice(-400).map(([t, o, h, l, c]) => ({ t: Date.parse(t.replace(/([+-]\d\d)(\d\d)$/, "$1:$2")), o, h, l, c }));
    cache.set(ck, { at: now, candles });
    return { candles, available: true };
  });
}
