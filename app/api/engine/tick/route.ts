import { createHash, timingSafeEqual } from "node:crypto";
import { ensureEngine, tickOnce } from "@/lib/engine/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Cron/ops hook: fills crossed pending orders and runs loss-limit checks. Needs header x-engine-secret = ENGINE_SECRET. */
export async function POST(req: Request) {
  const secret = process.env.ENGINE_SECRET;
  if (!secret) return Response.json({ ok: false, error: "ENGINE_SECRET is not set." }, { status: 503 });
  const given = req.headers.get("x-engine-secret") ?? "";
  if (!timingSafeEqual(digest(given), digest(secret))) return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  ensureEngine();
  const r = await tickOnce();
  return Response.json(r, { status: r.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
