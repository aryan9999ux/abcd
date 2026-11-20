import { requireUser } from "@/lib/engine/auth";
import { parse, readJson, run } from "@/lib/engine/http";
import { paymentSchema } from "@/lib/engine/schemas";
import { submitPayment } from "@/lib/engine/service";
import { recordConsent } from "@/lib/engine/consent";
import { adminClient } from "@/lib/supabase/admin";
import { CHECKOUT_TEXT } from "@/lib/legal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The trader says they paid and sends the UTR. An admin checks the bank and approves. */
export function POST(req: Request) {
  return run(async () => {
    const userId = await requireUser();
    const body = parse(paymentSchema, await readJson(req));
    const r = await submitPayment(userId, body);
    try {
      const { data } = await adminClient().auth.admin.getUserById(userId);
      await recordConsent(req, { userId, email: data?.user?.email ?? null, context: "checkout", text: CHECKOUT_TEXT, paymentRef: r.paymentId });
    } catch (e) { console.error("[consent]", e instanceof Error ? e.message : e); }
    return r;
  });
}
