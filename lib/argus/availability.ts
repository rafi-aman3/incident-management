import { createClient } from "@/lib/supabase/server";
import { orgCan } from "@/lib/auth/orgCan";

/**
 * Single source of truth for "can the user see Argus surfaces on this page?"
 * Combines org-level flag + user permission with one round-trip to Postgres
 * (the orgCan call is cached per request).
 *
 * Pages mounting `<ArgusInsightTile>` should gate the render on the result —
 * an unavailable Argus shouldn't render skeletons that will 503 on fetch.
 */
export async function isArgusAvailable(orgId: string | null): Promise<boolean> {
  if (!orgId) return false;
  const supabase = await createClient();
  const [orgFlag, perm] = await Promise.all([
    supabase
      .from("orgs")
      .select("argus_enabled")
      .eq("id", orgId)
      .maybeSingle(),
    orgCan("argus:use"),
  ]);
  return Boolean(orgFlag.data?.argus_enabled) && perm;
}
