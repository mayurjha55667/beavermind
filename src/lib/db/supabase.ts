import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnvironment } from "@/lib/env";

let client: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const environment = getServerEnvironment();
    client = createClient(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
