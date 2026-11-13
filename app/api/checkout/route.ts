import { requireUser } from "@/lib/engine/auth";
import { parse, readJson, run } from "@/lib/engine/http";
import { checkoutSchema } from "@/lib/engine/schemas";
import { createCheckout } from "@/lib/engine/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dev mode: creates a paid purchase and the trading account. A payment gateway replaces this later. */
export function POST(req: Request) {
  return run(async () => {
    const userId = await requireUser();
    return createCheckout(userId, parse(checkoutSchema, await readJson(req)));
  });
}
