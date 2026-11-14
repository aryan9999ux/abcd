import { requireUser } from "@/lib/engine/auth";
import { HttpError, run } from "@/lib/engine/http";
import { kick } from "@/lib/engine/runtime";
import { greeks } from "@/lib/market/greeks";
import { contractsReady, ensureInstruments, specOf, strikesOf } from "@/lib/market/instruments";
import { INDEX_SYMBOLS } from "@/lib/market/pricing";
import { getDetail, getSpot, want } from "@/lib/market/server-feed";
import { instrumentKey } from "@/lib/types";
import type { ChainRow, ChainSide } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HALF = 8; // strikes either side of the at-the-money strike

/** Live option chain from the exchange: real premiums, bid/ask and open interest; IV and delta calculated from them. */
export function GET(req: Request) {
  return run(async () => {
    await requireUser();
    kick();
    const sp = new URL(req.url).searchParams;
    const underlying = (sp.get("underlying") ?? "").toUpperCase();
    const expiry = sp.get("expiry") ?? "";
    if (!INDEX_SYMBOLS.includes(underlying)) throw new HttpError(400, "Options are available on Nifty, Bank Nifty and Sensex.");
    await ensureInstruments();
    const spec = specOf(underlying);
    if (!contractsReady() || !spec) return { ready: false, spot: getSpot(underlying) ?? null, rows: [] as ChainRow[] };
    if (!spec.optExpiries.includes(expiry)) throw new HttpError(400, "That expiry is not available.");
    const strikes = strikesOf(underlying, expiry);
    const spot = getSpot(underlying) ?? null;
    let at = 0;
    if (spot != null && strikes.length) at = strikes.reduce((b, k, i) => (Math.abs(k - spot) < Math.abs(strikes[b] - spot) ? i : b), 0);
    const slice = strikes.slice(Math.max(0, at - HALF), at + HALF + 1);
    const now = Date.now();
    const side = (seg: "CE" | "PE", k: number): ChainSide => {
      const key = instrumentKey({ underlying, segment: seg, strike: k, expiry });
      want([key]);
      const d = getDetail(key);
      if (!d) return { ltp: null, bid: null, ask: null, oi: null, iv: null, delta: null };
      const g = spot != null ? greeks(seg, spot, k, expiry, d.ltp, now) : null;
      return { ltp: d.ltp, bid: d.bid ?? null, ask: d.ask ?? null, oi: d.oi ?? null, iv: g ? g.iv * 100 : null, delta: g ? g.delta : null };
    };
    const rows: ChainRow[] = slice.map((k) => ({ strike: k, atm: strikes[at] === k, ce: side("CE", k), pe: side("PE", k) }));
    return { ready: true, spot, rows };
  });
}
