import { requireUser } from "@/lib/engine/auth";
import { run } from "@/lib/engine/http";
import { ALL_SYMBOLS } from "@/lib/market/pricing";
import { contractsReady } from "@/lib/market/instruments";
import { feedName, getSpots } from "@/lib/market/server-feed";
import { kick } from "@/lib/engine/runtime";
import { parseInstrumentKey, type QuotesResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validContract = (k: string) => {
  const r = parseInstrumentKey(k);
  return (r.segment === "FUT" || r.segment === "CE" || r.segment === "PE") && ALL_SYMBOLS.includes(r.underlying) && !!r.expiry;
};

/**
 * Server-authoritative prices; the client never supplies a price it expects to fill at.
 * `symbols` are underlyings. `instruments` are contract keys (positions, the selected contract); asking
 * for them needs a signed-in user and keeps them priced by the live feed.
 */
export async function GET(req: Request) {
  kick();
  const sp = new URL(req.url).searchParams;
  const raw = sp.get("symbols");
  const asked = raw ? raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => ALL_SYMBOLS.includes(s)).slice(0, 20) : [];
  const symbols = asked.length ? asked : ALL_SYMBOLS;
  const rawContracts = sp.get("instruments");
  let contracts: string[] = [];
  if (rawContracts) {
    return run(async () => {
      await requireUser();
      contracts = rawContracts.split(",").filter(validContract).slice(0, 40);
      const body: QuotesResponse = { ts: Date.now(), source: feedName(), quotes: getSpots(symbols, contracts), ready: contractsReady() };
      return body as unknown as Record<string, unknown>;
    });
  }
  const body: QuotesResponse = { ts: Date.now(), source: feedName(), quotes: getSpots(symbols), ready: contractsReady() };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
