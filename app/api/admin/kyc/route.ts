import { z } from "zod";
import { requireAdmin } from "@/lib/engine/admin";
import { parse, readJson, run } from "@/lib/engine/http";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ userId: z.string().uuid(), verified: z.boolean(), note: z.string().max(300).optional() });

export function POST(req: Request) {
  return run(async () => {
    await requireAdmin();
    const b = parse(schema, await readJson(req));
    const { error } = await adminClient().from("kyc_status").upsert({ user_id: b.userId, verified: b.verified, note: b.note ?? null, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return {};
  });
}
