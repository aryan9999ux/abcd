"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser client acting as the logged-in trader. Row level security applies. */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
