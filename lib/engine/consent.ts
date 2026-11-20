import "server-only";
import { adminClient } from "../supabase/admin";
import { POLICY_DOCS, TERMS_VERSION } from "../legal";

/** Saves proof that a person ticked the box: who, when, from where, which version and the exact words shown. */
export async function recordConsent(req: Request, c: { userId: string | null; email: string | null; context: "signup" | "checkout"; text: string; paymentRef?: string }) {
  const h = req.headers;
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || null;
  const { error } = await adminClient().from("terms_acceptances").insert({
    user_id: c.userId, email: c.email, context: c.context, terms_version: TERMS_VERSION, checkbox_text: c.text, documents: POLICY_DOCS,
    payment_ref: c.paymentRef ?? null, ip, user_agent: (h.get("user-agent") ?? "").slice(0, 400) || null, page_url: (h.get("referer") ?? "").slice(0, 300) || null,
  });
  if (error) throw new Error(`record consent: ${error.message}`);
}
