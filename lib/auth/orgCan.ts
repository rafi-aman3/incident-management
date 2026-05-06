import { resolveOrgPermissions } from "@/lib/rbac/resolve-org";
import type { PermissionKey } from "@/lib/rbac/permissions";

/**
 * Org-scoped permission check (any-site).
 * Use for resources owned by the org rather than a specific site —
 * notably templates, where a user with `template:edit` on any site can
 * edit org templates.
 *
 * For site-scoped checks (incidents, inspections, findings) use `can()`.
 */
export async function orgCan(permission: PermissionKey): Promise<boolean> {
  const perms = await resolveOrgPermissions();
  return perms.has(permission);
}

/**
 * Server-Action / page guard for org-scoped perms. Throws on deny.
 */
export async function requireOrgPermission(
  permission: PermissionKey
): Promise<void> {
  if (!(await orgCan(permission))) {
    throw new Error(`Forbidden: missing org permission ${permission}`);
  }
}
