import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  AlertOctagon,
  ClipboardList,
  ListChecks,
  ShieldCheck,
  FileBarChart,
  Settings2,
  PlusCircle,
} from "lucide-react";
import type { RoleKey } from "@/lib/supabase/auth";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: ReadonlyArray<RoleKey>;
};

const ALL: ReadonlyArray<RoleKey> = ["worker", "supervisor", "ehs_manager", "site_admin"];
const SUPERVISOR_PLUS: ReadonlyArray<RoleKey> = ["supervisor", "ehs_manager", "site_admin"];
const ADMIN_ONLY: ReadonlyArray<RoleKey> = ["site_admin"];

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/dashboard",          label: "Dashboard",       icon: LayoutDashboard, roles: ALL },
  { href: "/incidents/new/1",    label: "Report Incident", icon: PlusCircle,      roles: ALL },
  { href: "/incidents",          label: "Incidents",       icon: AlertOctagon,    roles: ALL },
  { href: "/investigations",     label: "Investigations",  icon: ClipboardList,   roles: SUPERVISOR_PLUS },
  { href: "/capa",               label: "CAPA",            icon: ListChecks,      roles: ALL },
  { href: "/reports",            label: "Reports",         icon: FileBarChart,    roles: SUPERVISOR_PLUS },
  { href: "/admin",              label: "Admin",           icon: Settings2,       roles: ADMIN_ONLY },
];

export function navItemsForRole(role: RoleKey): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export const ROLE_BADGE: Record<RoleKey, { label: string; icon: LucideIcon }> = {
  worker:      { label: "Worker",       icon: ShieldCheck },
  supervisor:  { label: "Supervisor",   icon: ShieldCheck },
  ehs_manager: { label: "EHS Manager",  icon: ShieldCheck },
  site_admin:  { label: "Site Admin",   icon: ShieldCheck },
};
