import { requireUser } from "@/lib/engine/auth";
import { parse, readJson, run } from "@/lib/engine/http";
import { kick } from "@/lib/engine/runtime";
import { levelsSchema } from "@/lib/engine/schemas";
import { setLevels } from "@/lib/engine/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return run(async () => {
    const userId = await requireUser();
    const body = parse(levelsSchema, await readJson(req));
    kick();
    return setLevels(userId, body);
  });
}
