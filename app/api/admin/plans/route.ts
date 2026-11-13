import { z } from "zod";
import { requireAdmin } from "@/lib/engine/admin";
import { HttpError, parse, readJson, run } from "@/lib/engine/http";
import { adminClient } from "@/lib/supabase/admin";
import { validateRules, type PlanRules } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ planKey: z.string().min(1).max(40), rules: z.unknown() });

/** Save new rules for a plan. Accounts that already exist keep the rules they were bought with. */
export function POST(req: Request) {
  return run(async () => {
    await requireAdmin();
    const b = parse(schema, await readJson(req));
    const bad = validateRules(b.rules);
    if (bad) throw new HttpError(400, bad);
    const r = b.rules as PlanRules;
    const { error } = await adminClient().from("plans").update({
      rules: r, max_daily_loss_pct: r.dailyLossPct, max_overall_loss_pct: r.drawdownPct,
      phase1_target_pct: r.targetsPct[0] ?? null, phase2_target_pct: r.targetsPct[1] ?? null, min_trading_days: r.evalProfitableDay.days,
    }).eq("key", b.planKey);
    if (error) throw new Error(error.message);
    return {};
  });
}
