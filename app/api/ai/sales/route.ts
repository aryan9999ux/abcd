import { run, readJson, HttpError } from "@/lib/engine/http";
import { ask, cleanHistory, limit } from "@/lib/ai/model";
import { planFactsText, SALES_PROMPT } from "@/lib/ai/facts";
import { userFacts } from "@/lib/ai/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Website chat. Anyone can use it. If the visitor is signed in and has not bought yet, it knows their name and status. */
export function POST(req: Request) {
  return run(async () => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    limit(`s:${ip}`);
    const body = (await readJson(req)) as { messages?: unknown };
    const history = cleanHistory(body.messages);
    const me = await userFacts().catch(() => null);
    const who = me ? `The visitor is signed in as ${me.name}. ${me.hasBought ? "They already own an account." : "They have NOT bought an account yet, so help them choose and buy."}\n${me.text}` : "The visitor is not signed in.";
    if (history.length > 40) throw new HttpError(400, "Chat is too long.");
    return { reply: await ask(SALES_PROMPT(await planFactsText(), who), history) };
  });
}
