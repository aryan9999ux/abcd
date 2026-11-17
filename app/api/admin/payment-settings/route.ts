import { requireAdmin } from "@/lib/engine/admin";
import { HttpError, run } from "@/lib/engine/http";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin sets the UPI ID, the payee name and the QR image shown at checkout. */
export function POST(req: Request) {
  return run(async () => {
    await requireAdmin();
    const f = await req.formData();
    const upi = String(f.get("upiId") ?? "").trim();
    const payee = String(f.get("payeeName") ?? "").trim();
    if (upi && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) throw new HttpError(400, "Enter a valid UPI ID.");
    const sb = adminClient();
    const patch: Record<string, unknown> = { upi_id: upi || null, payee_name: payee || null, updated_at: new Date().toISOString() };
    const file = f.get("qr");
    if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith("image/")) throw new HttpError(400, "The QR must be an image.");
      if (file.size > 3_000_000) throw new HttpError(400, "The QR image must be under 3 MB.");
      const path = `qr-${Date.now()}.${file.type.split("/")[1]?.replace("jpeg", "jpg") || "png"}`;
      const up = await sb.storage.from("payment-qr").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
      if (up.error) throw new Error(up.error.message);
      patch.qr_path = path;
    }
    const { error } = await sb.from("payment_settings").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    return {};
  });
}
