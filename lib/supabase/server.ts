import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Per-request client that acts as the logged-in trader (row level security applies). */
export async function userClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* called from a Server Component; middleware refreshes sessions */
          }
        },
      },
    },
  );
}
