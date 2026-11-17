import { requireUser } from "@/lib/engine/auth";
import { parse, readJson, run } from "@/lib/engine/http";
import { demoSchema } from "@/lib/engine/schemas";
import { createDemo } from "@/lib/engine/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts the user's one free 3-day demo account on the plan they chose. */
export function POST(req: Request) {
  return run(async () => {
    const userId = await requireUser();
    return createDemo(userId, parse(demoSchema, await readJson(req)).planKey);
  });
}
