import { requireUser } from "@/lib/engine/auth";
import { parse, readJson, run } from "@/lib/engine/http";
import { payoutRequestSchema } from "@/lib/engine/schemas";
import { requestPayout } from "@/lib/engine/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A trader asks for a reward. The rules are checked here; the team reviews it afterwards. */
export function POST(req: Request) {
  return run(async () => {
    const userId = await requireUser();
    const body = parse(payoutRequestSchema, await readJson(req));
    return requestPayout(userId, body.accountId);
  });
}
