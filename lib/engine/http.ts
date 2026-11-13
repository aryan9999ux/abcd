import { z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Send a JSON body.");
  }
}

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const i = r.error.issues[0];
    const where = i?.path.length ? `${i.path.join(".")}: ` : "";
    throw new HttpError(400, `${where}${i?.message ?? "Invalid request"}`);
  }
  return r.data;
}

/** Wrap a handler: success -> { ok: true, ...result }, failure -> { ok: false, error } with a safe message. */
export async function run<T extends object>(fn: () => Promise<T>): Promise<Response> {
  try {
    const result = await fn();
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[api]", e);
    return Response.json({ ok: false, error: "Something went wrong on our side. Try again." }, { status: 500 });
  }
}
