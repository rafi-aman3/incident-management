import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  AlertOctagon,
  ClipboardCheck,
  ClipboardList,
  ClipboardSignature,
  ListChecks,
  ShieldCheck,
  FileBarChart,
  Settings2,
  PlusCircle,
} from "lucide-react";
import type { RoleKey } from "@/lib/supabase/auth";
import type { PermissionKey } from "@/lib/rbac/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Permission required to see this item. `undefined` means visible to any
   * authenticated user (e.g. the dashboard). The layout filters server-side
   * via `can(permission, currentSiteId)` and passes allowed hrefs to the
   * client sidebar.
   *
   * Note: a few items are gated on a "viewer-tier" permission (e.g. /reports
   * on `incident:read_site`) until proper read-only perms (`investigation:read_site`,
   * `report:read_site`) are added in Phase 2. Workers don't have those
   * perms — Phase 1 sidebar matches ui-flow §1.2 already.
   */
  permission?: PermissionKey;
};

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/dashboard",       label: "Dashboard",       icon: LayoutDashboard },
  { href: "/incidents/new/1", label: "Report Incident", icon: PlusCircle,         permission: "incident:report" },
  { href: "/incidents",       label: "Incidents",       icon: AlertOctagon,       permission: "incident:read_site" },
  { href: "/investigations",  label: "Investigations",  icon: ClipboardList,      permission: "incident:read_site" },
  { href: "/capa",            label: "CAPA",            icon: ListChecks,         permission: "capa:complete" },
  // Templates is org-scoped (not per-site); the layout's site-scoped can()
  // filter is loose enough that a worker with template:read_org via any
  // membership will see it. site_admin / ehs_manager / supervisor / worker
  // all hold template:read_org by default per Phase 3 perms migration.
  { href: "/templates",       label: "Templates",       icon: ClipboardCheck,     permission: "template:read_org" },
  { href: "/inspections",     label: "Inspections",     icon: ClipboardSignature, permission: "inspection:read_site" },
  { href: "/reports",         label: "Reports",         icon: FileBarChart,       permission: "incident:read_site" },
  { href: "/admin",           label: "Admin",           icon: Settings2,          permission: "site:configure" },
];

export const ROLE_BADGE: Record<RoleKey, { label: string; icon: LucideIcon }> = {
  worker:      { label: "Worker",       icon: ShieldCheck },
  supervisor:  { label: "Supervisor",   icon: ShieldCheck },
  ehs_manager: { label: "EHS Manager",  icon: ShieldCheck },
  site_admin:  { label: "Site Admin",   icon: ShieldCheck },
};
