import { requireAdmin } from "@/lib/engine/admin";
import { HttpError } from "@/lib/engine/http";
import { kiteConfigured, loginUrl } from "@/lib/market/kite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin only. Sends the admin to Zerodha's login page; Zerodha then calls /api/zerodha/callback. */
export async function GET() {
  try {
    await requireAdmin();
    if (!kiteConfigured()) return new Response("KITE_API_KEY and KITE_API_SECRET are not set on the server.", { status: 500 });
    return Response.redirect(loginUrl(), 302);
  } catch (e) {
    if (e instanceof HttpError) return new Response(e.message, { status: e.status });
    return new Response("Something went wrong.", { status: 500 });
  }
}
