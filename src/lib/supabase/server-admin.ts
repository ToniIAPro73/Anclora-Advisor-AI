import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/env";

function getServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }
  return value;
}

export function createServiceSupabaseClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
