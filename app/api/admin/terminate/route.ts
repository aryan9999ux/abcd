import { z } from "zod";
import { requireAdmin } from "@/lib/engine/admin";
import { parse, readJson, run } from "@/lib/engine/http";
import { adminTerminate } from "@/lib/engine/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ accountId: z.string().uuid(), reason: z.string().trim().min(3).max(300) });

export function POST(req: Request) {
  return run(async () => {
    await requireAdmin();
    const b = parse(schema, await readJson(req));
    return adminTerminate(b.accountId, b.reason);
  });
}
