import { z } from "zod";
import { run, parse, readJson, HttpError } from "@/lib/engine/http";
import { recordConsent } from "@/lib/engine/consent";
import { adminClient } from "@/lib/supabase/admin";
import { SIGNUP_TEXT } from "@/lib/legal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ userId: z.string().uuid(), email: z.string().email().max(200) });

/**
 * Called right after sign-up (the person may not be signed in yet if email confirmation is on).
 * Only accepted for a brand-new account whose email matches, and only once.
 */
export function POST(req: Request) {
  return run(async () => {
    const b = parse(schema, await readJson(req));
    const db = adminClient();
    const { data, error } = await db.auth.admin.getUserById(b.userId);
    const u = data?.user;
    if (error || !u || (u.email ?? "").toLowerCase() !== b.email.toLowerCase()) throw new HttpError(400, "Could not confirm this account.");
    if (Date.now() - Date.parse(u.created_at) > 15 * 60_000) throw new HttpError(400, "This sign-up is too old to record.");
    const { count } = await db.from("terms_acceptances").select("id", { count: "exact", head: true }).eq("user_id", b.userId).eq("context", "signup");
    if ((count ?? 0) > 0) return {};
    await recordConsent(req, { userId: b.userId, email: b.email.toLowerCase(), context: "signup", text: SIGNUP_TEXT });
    return {};
  });
}
