import { run, readJson } from "@/lib/engine/http";
import { requireUser } from "@/lib/engine/auth";
import { ask, cleanHistory, limit } from "@/lib/ai/model";
import { planFactsText, SALES_PROMPT, SUPPORT_PROMPT } from "@/lib/ai/facts";
import { userFacts } from "@/lib/ai/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Portal chat. Uses the trader's own data. If they have not bought yet, it sells instead of supporting. */
export function POST(req: Request) {
  return run(async () => {
    const id = await requireUser();
    limit(`u:${id}`, 15);
    const body = (await readJson(req)) as { messages?: unknown };
    const history = cleanHistory(body.messages);
    const me = await userFacts();
    const plans = await planFactsText();
    const system = me && !me.hasBought
      ? SALES_PROMPT(plans, `The visitor is signed in as ${me.name} and has NOT bought an account yet, so help them choose and buy.\n${me.text}`)
      : SUPPORT_PROMPT(plans, me?.text ?? "unknown");
    return { reply: await ask(system, history) };
  });
}
