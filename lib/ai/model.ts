import "server-only";
import { HttpError } from "@/lib/engine/http";

export interface Msg { role: "user" | "assistant"; text: string }

/**
 * One function for "ask the model". Today it talks to Google Gemini (AI Studio) over plain REST.
 * Env: GEMINI_API_KEY (required), AI_MODEL (optional, default is the cheap Flash-Lite model).
 * To switch provider later, only this file changes.
 */
export async function ask(system: string, history: Msg[], maxTokens = 450): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(503, "The assistant is not switched on yet.");
  const model = process.env.AI_MODEL || "gemini-2.5-flash-lite";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: history.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    console.error("[ai]", res.status, (await res.text()).slice(0, 300));
    throw new HttpError(502, "I could not answer just now. Please try again in a moment.");
  }
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new HttpError(502, "I could not answer just now. Please try again in a moment.");
  return text;
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
