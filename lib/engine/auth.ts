import "server-only";
import { userClient } from "../supabase/server";
import { HttpError } from "./http";

/** The logged-in trader's id, verified with Supabase Auth from the session cookie. */
export async function requireUser(): Promise<string> {
  const sb = await userClient();
  // getClaims checks the session token's signature locally, so no network trip to the auth server on every order.
  const { data: c } = await sb.auth.getClaims();
  if (c?.claims?.sub) return c.claims.sub;
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Sign in to continue.");
  return data.user.id;
}
