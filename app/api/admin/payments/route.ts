import { requireAdmin } from "@/lib/engine/admin";
import { parse, readJson, run } from "@/lib/engine/http";
import { paymentDecisionSchema } from "@/lib/engine/schemas";
import { decidePayment } from "@/lib/engine/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return run(async () => {
    await requireAdmin();
    const b = parse(paymentDecisionSchema, await readJson(req));
    return decidePayment(b.paymentId, b.action, b.reason);
  });
}
