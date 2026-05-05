/**
 * System permission registry — mirrors the rows seeded into `permissions`
 * in supabase/migrations/20260505120000_init.sql §4.
 *
 * Permission keys are system-defined strings, referenced by `role_permissions`
 * and `team_permissions`. Not user-editable. Roles are user-editable rows
 * that compose these keys (per memory `project_rbac_model.md`).
 */

export const PERMISSIONS = [
  "site:read",
  "site:configure",
  "member:invite",
  "member:manage",
  "role:read",
  "role:edit",
  "team:manage",
  "incident:report",
  "incident:read_own",
  "incident:read_site",
  "incident:override_severity",
  "incident:assign",
  "incident:close",
  "investigation:lead",
  "investigation:edit",
  "capa:create",
  "capa:complete",
  "capa:verify",
  "report:read",
  "report:export",
  "template:create",
  "template:publish",
  "inspection:run",
  "asset:manage",
  "document:upload",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];
