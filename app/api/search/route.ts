import { requireUser } from "@/lib/engine/auth";
import { run } from "@/lib/engine/http";
import { kick } from "@/lib/engine/runtime";
import { contractsReady, ensureInstruments, searchContracts } from "@/lib/market/instruments";
import { getSpot, getSpots } from "@/lib/market/server-feed";
import { instrumentKey } from "@/lib/types";
import { strikeInRange } from "@/lib/engine/pure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Contract search ("25700 PE", "nifty 25700 ce"). Hits come with a live price and are kept priced for a while. */
export function GET(req: Request) {
  return run(async () => {
    await requireUser();
    kick();
    await ensureInstruments();
    const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 60);
    if (!contractsReady()) return { ready: false, hits: [] };
    const hits = searchContracts(q, 30)
      .filter((h) => { const s = getSpot(h.underlying); return s == null || h.strike == null || strikeInRange(h.strike, s); })
      .slice(0, 12)
      .map((h) => ({ ...h, key: instrumentKey({ underlying: h.underlying, segment: h.segment, strike: h.strike ?? undefined, expiry: h.expiry }) }));
    const prices = getSpots([], hits.map((h) => h.key));
    return { ready: true, hits: hits.map((h) => ({ ...h, ltp: prices[h.key] ?? null })) };
  });
}
