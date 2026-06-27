import { createClient } from "@supabase/supabase-js";

export function createServerRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing supabase URL");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing service role key");
  }
  const supabase = createClient(
    supabaseUrl,
    supabaseServiceRoleKey, // Never expose this to the browser
    {
      auth: {
        persistSession: false, // Recommended for server operations
        autoRefreshToken: false,
      },
    },
  );

  return supabase;
}
