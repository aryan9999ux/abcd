import { requireUser } from "@/lib/engine/auth";
import { run } from "@/lib/engine/http";
import { kick } from "@/lib/engine/runtime";
import { allSpecs, contractsError, contractsReady, ensureInstruments } from "@/lib/market/instruments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Real lot sizes, expiries and strike steps from the exchange contract list. */
export function GET() {
  return run(async () => {
    await requireUser();
    kick();
    await ensureInstruments();
    return { ready: contractsReady(), error: contractsError(), specs: allSpecs() };
  });
}
