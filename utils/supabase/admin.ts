import { createClient } from "@supabase/supabase-js";

// WARNING: access to this client must be strictly controlled
// It bypasses Row Level Security (RLS) entirely
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
