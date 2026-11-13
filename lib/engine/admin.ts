import "server-only";
import { userClient } from "../supabase/server";
import { HttpError } from "./http";

/** Emails allowed to use the admin pages, from ADMIN_EMAILS (comma separated). */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** The signed-in admin, or an HttpError. */
export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const sb = await userClient();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Sign in to continue.");
  const email = (data.user.email ?? "").toLowerCase();
  if (!email || !adminEmails().includes(email)) throw new HttpError(403, "This page is for admins only.");
  return { id: data.user.id, email };
}

/** Public origin of this request, correct behind Railway's proxy. */
export function originOf(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
