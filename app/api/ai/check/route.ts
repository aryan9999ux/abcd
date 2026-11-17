import { run } from "@/lib/engine/http";
import { requireAdmin } from "@/lib/engine/admin";
import { tryAsk } from "@/lib/ai/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin only: sends "say hi" to the model and shows the real result or Google's error. Open /api/ai/check while signed in as admin. */
export function GET() {
  return run(async () => {
    await requireAdmin();
    const r = await tryAsk("Reply with the single word: ok", [{ role: "user", text: "ping" }], 20);
    return { keySet: !!process.env.GEMINI_API_KEY, keyStarts: (process.env.GEMINI_API_KEY ?? "").slice(0, 4), result: r };
  });
}
