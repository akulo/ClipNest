import { createClient } from "@supabase/supabase-js";

// Uses service role key — bypasses RLS. Only use server-side, never in client components.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
