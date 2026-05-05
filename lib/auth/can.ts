import { resolvePermissions } from "@/lib/rbac/resolve";
import type { PermissionKey } from "@/lib/rbac/permissions";

/**
 * Permission check for the current user against a specific site.
 * Use in Server Components for conditional UI; use requirePermission
 * in Server Actions for the auth gate.
 */
export async function can(
  permission: PermissionKey,
  siteId: string | null | undefined
): Promise<boolean> {
  const perms = await resolvePermissions(siteId);
  return perms.has(permission);
}

/**
 * Server-Action / page guard. Throws on deny so an action wrapper can
 * convert it into `{ ok: false, error: "Forbidden" }`. Pages that want
 * a redirect should call `can()` and dispatch their own `redirect()`.
 */
export async function requirePermission(
  permission: PermissionKey,
  siteId: string | null | undefined
): Promise<void> {
  if (!(await can(permission, siteId))) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}
