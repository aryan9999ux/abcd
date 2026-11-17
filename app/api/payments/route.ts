import { requireUser } from "@/lib/engine/auth";
import { parse, readJson, run } from "@/lib/engine/http";
import { paymentSchema } from "@/lib/engine/schemas";
import { submitPayment } from "@/lib/engine/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The trader says they paid and sends the UTR. An admin checks the bank and approves. */
export function POST(req: Request) {
  return run(async () => {
    const userId = await requireUser();
    return submitPayment(userId, parse(paymentSchema, await readJson(req)));
  });
}
