import "server-only";
import { HttpError } from "@/lib/engine/http";

export interface Msg { role: "user" | "assistant"; text: string }

/**
 * One function for "ask the model". Today it talks to Google Gemini (AI Studio) over plain REST.
 * Env: GEMINI_API_KEY (required), AI_MODEL (optional, default is the cheap Flash-Lite model).
 * To switch provider later, only this file changes.
 */
export async function ask(system: string, history: Msg[], maxTokens = 450): Promise<string> {
  const r = await tryAsk(system, history, maxTokens);
  if (r.ok) return r.text;
  console.error("[ai] all attempts failed:", r.error);
  throw new HttpError(502, "I could not answer just now. Please try again in a moment.");
}

let found: { at: number; list: string[] } | null = null;
/** Google retires models often, so ask it which ones this key can use. Cheapest first: newest Flash-Lite, then newest Flash. */
async function discover(key: string): Promise<string[]> {
  if (found && Date.now() - found.at < 3_600_000) return found.list;
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(10000) });
    const j = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const names = (j.models ?? []).filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name.replace("models/", ""))
      .filter((n) => /^gemini-[\d.]+-flash(-lite)?$/.test(n));
    const ver = (n: string) => parseFloat(n.match(/gemini-([\d.]+)/)![1]);
    const sorted = (re: RegExp) => names.filter((n) => re.test(n)).sort((a, b) => ver(b) - ver(a));
    const list = [...sorted(/flash-lite$/), ...sorted(/-flash$/)];
    if (list.length) found = { at: Date.now(), list };
    return list;
  } catch { return []; }
}

/** Tries each endpoint and model until one answers. Keys starting "AQ." are Vertex AI express keys; "AIza" keys are AI Studio keys. */
export async function tryAsk(system: string, history: Msg[], maxTokens = 450): Promise<{ ok: true; text: string; used: string } | { ok: false; error: string }> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { ok: false, error: "GEMINI_API_KEY is not set on the server." };
  const models = [...new Set([process.env.AI_MODEL?.trim(), ...(await discover(key))].filter(Boolean) as string[])].slice(0, 4);
  const bases = ["https://generativelanguage.googleapis.com/v1beta/models"];
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: history.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
  });
  const errs: string[] = [];
  for (const base of bases) for (const model of models) {
    try {
      const res = await fetch(`${base}/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body, signal: AbortSignal.timeout(20000) });
      if (!res.ok) { errs.push(`${new URL(base).host} ${model}: ${res.status} ${(await res.text()).slice(0, 160)}`); if (res.status === 401 || res.status === 403) break; continue; }
      const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (text) return { ok: true, text, used: `${new URL(base).host} ${model}` };
      errs.push(`${model}: empty answer`);
    } catch (e) { errs.push(`${model}: ${(e as Error).message}`); }
  }
  return { ok: false, error: errs.join(" || ") };
}

const hits = new Map<string, number[]>();
/** Small per-server limiter: stops one visitor from running up the bill. */
export function limit(id: string, max = 12, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new HttpError(429, "You are sending messages very fast. Wait a few seconds.");
  arr.push(now); hits.set(id, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
}

export function cleanHistory(raw: unknown): Msg[] {
  if (!Array.isArray(raw)) throw new HttpError(400, "Send your messages.");
  const out = raw.slice(-10).map((m) => ({ role: m?.role === "assistant" ? "assistant" as const : "user" as const, text: String(m?.text ?? "").slice(0, 600) })).filter((m) => m.text.trim());
  while (out.length && out[0].role !== "user") out.shift();
  if (!out.length || out[out.length - 1].role !== "user") throw new HttpError(400, "Send a message.");
  return out;
}
