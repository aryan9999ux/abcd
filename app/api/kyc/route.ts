import { requireUser } from "@/lib/engine/auth";
import { HttpError, parse, run } from "@/lib/engine/http";
import { kycSchema } from "@/lib/engine/schemas";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["pan", "aadhaar", "selfie"] as const;
const OK_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** A trader submits (or corrects) identity details and document photos. Photos go to a private bucket; only admins can open them. */
export function POST(req: Request) {
  return run(async () => {
    const userId = await requireUser();
    const f = await req.formData().catch(() => { throw new HttpError(400, "Send the form again."); });
    const text = Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
    const b = parse(kycSchema, text);
    const sb = adminClient();
    const cur = await sb.from("kyc_submissions").select("*").eq("user_id", userId).maybeSingle();
    if (cur.data?.status === "verified") throw new HttpError(409, "You are already verified. Contact support to change your details.");

    const paths: Record<string, string | null> = { pan: cur.data?.pan_photo ?? null, aadhaar: cur.data?.aadhaar_photo ?? null, selfie: cur.data?.selfie_photo ?? null };
    for (const k of KINDS) {
      const file = f.get(`${k}Photo`);
      if (file instanceof File && file.size > 0) {
        const ext = OK_TYPES[file.type];
        if (!ext) throw new HttpError(400, "Photos must be JPG, PNG or WebP.");
        if (file.size > 5_000_000) throw new HttpError(400, "Each photo must be under 5 MB.");
        const path = `${userId}/${k}-${Date.now()}.${ext}`;
        const up = await sb.storage.from("kyc-docs").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
        if (up.error) throw new Error(up.error.message);
        paths[k] = path;
      }
    }
    const missing = KINDS.filter((k) => !paths[k]).map((k) => (k === "pan" ? "your PAN card" : k === "aadhaar" ? "your Aadhaar card" : "the selfie with your Aadhaar"));
    if (missing.length) throw new HttpError(400, `Please add a photo of ${missing.join(", ")}.`);

    const { error } = await sb.from("kyc_submissions").upsert({
      user_id: userId, full_name: b.fullName, pan: b.pan, aadhaar_no: b.aadhaarNo, district: b.district, state: b.state,
      payout_method: b.method, upi_id: b.method === "upi" ? b.upiId : null,
      bank_account: b.method === "bank" ? b.bankAccount : null, bank_ifsc: b.method === "bank" ? b.bankIfsc : null,
      pan_photo: paths.pan, aadhaar_photo: paths.aadhaar, selfie_photo: paths.selfie,
      status: "pending", reviewer_note: null, submitted_at: new Date().toISOString(), reviewed_at: null,
    });
    if (error) throw new Error(error.message);
    return {};
  });
}
