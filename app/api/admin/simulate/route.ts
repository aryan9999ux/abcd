import { z } from "zod";
import { requireAdmin } from "@/lib/engine/admin";
import { HttpError, parse, readJson, run } from "@/lib/engine/http";
import { validateRules, type PlanRules } from "@/lib/rules";
import { DEFAULT_ARCHETYPES, simulate } from "@/lib/sim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const arch = z.object({ name: z.string().max(60), share: z.number().min(0).max(100), winRate: z.number().min(0.01).max(0.99), rr: z.number().min(0.1).max(20), tradesPerDay: z.number().min(1).max(20), riskPct: z.number().min(0.05).max(10) });
const schema = z.object({
  rules: z.unknown(), accountSize: z.number().positive(), feeInr: z.number().min(0), traders: z.number().int().min(100).max(20000).default(3000),
  horizonDays: z.number().int().min(20).max(500).default(180), seed: z.number().int().default(7), rebuyProb: z.number().min(0).max(1).default(0.5), maxRebuys: z.number().int().min(0).max(10).default(3), archetypes: z.array(arch).min(1).max(8).optional(),
});

/** Admin only. This logic is server-side so it is never shipped to the site or trader pages. */
export function POST(req: Request) {
  return run(async () => {
    await requireAdmin();
    const b = parse(schema, await readJson(req));
    const bad = validateRules(b.rules);
    if (bad) throw new HttpError(400, bad);
    const result = simulate({ rules: b.rules as PlanRules, accountSize: b.accountSize, feeInr: b.feeInr, traders: b.traders, horizonDays: b.horizonDays, seed: b.seed, rebuyProb: b.rebuyProb, maxRebuys: b.maxRebuys, archetypes: b.archetypes ?? DEFAULT_ARCHETYPES });
    return { result };
  });
}
