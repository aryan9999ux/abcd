import { requireUser } from "@/lib/engine/auth";
import { parse, readJson, run } from "@/lib/engine/http";
import { cancelOrderSchema } from "@/lib/engine/schemas";
import { cancelOrder } from "@/lib/engine/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return run(async () => {
    const userId = await requireUser();
    return cancelOrder(userId, parse(cancelOrderSchema, await readJson(req)));
  });
}
