import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { PermissionKey } from "./permissions";

/**
 * Resolve the union of the current user's role + team permissions for the
 * given site. Per-request memoized via React.cache so multiple can() calls
 * during one render share a single round-trip.
 *
 * Returns an empty Set when:
 *   - siteId is null/undefined (no current site)
 *   - the RPC errors (logged; treated as deny-all for safety)
 *   - the user has no membership/team binding to the site
 */
export const resolvePermissions = cache(
  async (siteId: string | null | undefined): Promise<Set<PermissionKey>> => {
    if (!siteId) return new Set();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("resolve_permissions", {
      p_site_id: siteId,
    });
    if (error) {
      console.error("[rbac] resolve_permissions failed:", error.message);
      return new Set();
    }
    return new Set((data ?? []) as PermissionKey[]);
  }
);
