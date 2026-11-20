import { requireUser } from "@/lib/engine/auth";
import { ALL_SYMBOLS } from "@/lib/market/pricing";
import { contractsReady } from "@/lib/market/instruments";
import { feedName, getPrevs, getSpots, onPrice, want } from "@/lib/market/server-feed";
import { kick } from "@/lib/engine/runtime";
import { parseInstrumentKey } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validContract = (k: string) => {
  const r = parseInstrumentKey(k);
  return (r.segment === "FUT" || r.segment === "CE" || r.segment === "PE") && ALL_SYMBOLS.includes(r.underlying) && !!r.expiry;
};

/**
 * Live prices pushed as they arrive (Server-Sent Events). First a full snapshot, then only the keys that
 * changed, at most ten times a second. Contract keys need a signed-in user and are kept priced while connected.
 */
export async function GET(req: Request) {
  kick();
  const sp = new URL(req.url).searchParams;
  const raw = sp.get("symbols");
  const asked = raw ? raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => ALL_SYMBOLS.includes(s)).slice(0, 20) : [];
  const symbols = asked.length ? asked : ALL_SYMBOLS;
  let contracts: string[] = [];
  const rawContracts = sp.get("instruments");
  if (rawContracts) {
    try { await requireUser(); } catch { return new Response("unauthorized", { status: 401 }); }
    contracts = rawContracts.split(",").filter(validContract).slice(0, 40);
  }
  const watch = new Set([...symbols, ...contracts]);
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(ctrl) {
      const send = (event: string, data: unknown) => { try { ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { cleanup(); } };
      const snap = () => send("snap", { ts: Date.now(), source: feedName(), quotes: getSpots(symbols, contracts), prev: getPrevs([...symbols, ...contracts]), ready: contractsReady() });
      snap();
      let pending: Record<string, number> = {};
      const flush = setInterval(() => {
        const keys = Object.keys(pending);
        if (!keys.length) return;
        const q = pending; pending = {};
        send("t", { ts: Date.now(), quotes: q });
      }, 100);
      const off = onPrice((k, p) => { if (watch.has(k)) pending[k] = Math.round(p * 100) / 100; });
      // re-announce contract interest, and resend a snapshot now and then so closes and readiness stay current
      const keep = setInterval(() => { if (contracts.length) want(contracts); kick(); }, 15_000);
      const resnap = setInterval(snap, 30_000);
      const beat = setInterval(() => { try { ctrl.enqueue(enc.encode(": hb\n\n")); } catch { cleanup(); } }, 15_000);
      cleanup = () => { clearInterval(flush); clearInterval(keep); clearInterval(resnap); clearInterval(beat); off(); try { ctrl.close(); } catch { /* already closed */ } cleanup = () => {}; };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
