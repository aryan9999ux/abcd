import { z } from "zod";
import { requireAdmin } from "@/lib/engine/admin";
import { parse, readJson, run } from "@/lib/engine/http";
import { decideReward } from "@/lib/engine/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ rewardId: z.string().uuid(), action: z.enum(["approve", "reject", "paid"]), payoutRef: z.string().max(100).optional() });

export function POST(req: Request) {
  return run(async () => {
    await requireAdmin();
    const b = parse(schema, await readJson(req));
    return decideReward(b.rewardId, b.action, b.payoutRef);
  });
}
