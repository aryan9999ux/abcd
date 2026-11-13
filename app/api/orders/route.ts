import { requireUser } from "@/lib/engine/auth";
import { parse, readJson, run } from "@/lib/engine/http";
import { kick } from "@/lib/engine/runtime";
import { placeOrderSchema } from "@/lib/engine/schemas";
import { placeOrder } from "@/lib/engine/service";
import type { PlaceOrderRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return run(async () => {
    const userId = await requireUser();
    const body = parse(placeOrderSchema, await readJson(req));
    kick();
    return placeOrder(userId, body as PlaceOrderRequest);
  });
}
