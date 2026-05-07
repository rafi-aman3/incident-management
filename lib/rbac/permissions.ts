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
  "site:archive",
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
  "capa:reassign_verifier",
  "report:read",
  "report:export",
  "report:edit_hours",
  "notification:hse_record_edit",
  "demo:reset",
  "template:create",
  "template:read_org",
  "template:edit",
  "template:publish",
  "template:archive",
  "template:assign",
  "inspection:run",
  "inspection:read_site",
  "inspection:start",
  "inspection:edit_own",
  "inspection:edit_any",
  "inspection:complete",
  "inspection:delete",
  "finding:read",
  "finding:resolve",
  "finding:escalate",
  "asset:read_site",
  "asset:create",
  "asset:edit",
  "asset:delete",
  "document:read_org",
  "document:upload",
  "document:edit_metadata",
  "document:archive",
  "document_link:create",
  "document_link:remove",
  "planner:read",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];
