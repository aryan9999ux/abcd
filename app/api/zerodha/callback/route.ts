import { originOf, requireAdmin } from "@/lib/engine/admin";
import { HttpError } from "@/lib/engine/http";
import { exchangeRequestToken } from "@/lib/market/kite";
import { ensureEngine } from "@/lib/engine/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zerodha redirects here with ?request_token=...&status=success. Admin only. */
export async function GET(req: Request) {
  const back = (q: string) => Response.redirect(`${originOf(req)}/admin/zerodha?${q}`, 302);
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const token = url.searchParams.get("request_token");
    if (url.searchParams.get("status") !== "success" || !token) return back("error=Zerodha%20login%20was%20not%20completed.");
    await exchangeRequestToken(token);
    ensureEngine();
    return back("connected=1");
  } catch (e) {
    if (e instanceof HttpError) return new Response(e.message, { status: e.status });
    const msg = e instanceof Error ? e.message : "Could not connect.";
    return back(`error=${encodeURIComponent(msg)}`);
  }
}
