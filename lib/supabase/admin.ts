import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role client for server-only contexts that must bypass RLS:
 * cron handlers, scheduled jobs, admin tools. NEVER expose this from
 * a route reachable by end users — always validate the caller (e.g.,
 * cron secret, admin permission) before using it.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
