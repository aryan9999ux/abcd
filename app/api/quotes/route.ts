import { ALL_SYMBOLS } from "@/lib/market/pricing";
import { feedName, getSpots } from "@/lib/market/server-feed";
import { kick } from "@/lib/engine/runtime";
import type { QuotesResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public. Server-authoritative spot prices; the client never supplies a price it expects to fill at. */
export async function GET(req: Request) {
  kick();
  const raw = new URL(req.url).searchParams.get("symbols");
  const asked = raw ? raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => ALL_SYMBOLS.includes(s)).slice(0, 20) : [];
  const symbols = asked.length ? asked : ALL_SYMBOLS;
  const body: QuotesResponse = { ts: Date.now(), source: feedName(), quotes: getSpots(symbols) };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
