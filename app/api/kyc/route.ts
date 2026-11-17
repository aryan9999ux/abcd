import { requireUser } from "@/lib/engine/auth";
import { HttpError, parse, readJson, run } from "@/lib/engine/http";
import { kycSchema } from "@/lib/engine/schemas";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A trader submits (or corrects) their identity and payout details. Our team reviews them. */
export function POST(req: Request) {
  return run(async () => {
    const userId = await requireUser();
    const b = parse(kycSchema, await readJson(req));
    const sb = adminClient();
    const cur = await sb.from("kyc_submissions").select("status").eq("user_id", userId).maybeSingle();
    if (cur.data?.status === "verified") throw new HttpError(409, "You are already verified. Contact support to change your details.");
    const { error } = await sb.from("kyc_submissions").upsert({
      user_id: userId,
      full_name: b.fullName,
      pan: b.pan,
      payout_method: b.method,
      upi_id: b.method === "upi" ? b.upiId : null,
      bank_account: b.method === "bank" ? b.bankAccount : null,
      bank_ifsc: b.method === "bank" ? b.bankIfsc : null,
      status: "pending",
      reviewer_note: null,
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
    });
    if (error) throw new Error(error.message);
    return {};
  });
}
