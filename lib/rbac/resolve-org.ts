import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { PermissionKey } from "./permissions";

/**
 * Resolve the union of the current user's role + team permissions across
 * every site they're a member of in their current org. Mirrors
 * `resolvePermissions(siteId)` but for org-scoped checks (e.g. templates).
 *
 * Per-request memoized via React.cache.
 */
export const resolveOrgPermissions = cache(
  async (): Promise<Set<PermissionKey>> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("resolve_org_permissions");
    if (error) {
      console.error("[rbac] resolve_org_permissions failed:", error.message);
      return new Set();
    }
    return new Set((data ?? []) as PermissionKey[]);
  }
);
