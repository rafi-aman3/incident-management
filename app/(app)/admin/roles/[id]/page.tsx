import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RolePermissionsForm } from "@/components/admin/role-permissions-form";
import { DeleteRoleDialog } from "@/components/admin/delete-role-dialog";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFirst(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return "";
}

export default async function AdminRoleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const { supabase, profile } = await requireUser();

  const [canRead, canEdit, canDelete] = await Promise.all([
    orgCan("role:read"),
    orgCan("role:edit"),
    orgCan("role:delete"),
  ]);
  if (!canRead) redirect("/admin");

  const { data: role } = await supabase
    .from("roles")
    .select("id, key, name, description, is_default, created_at, org_id")
    .eq("id", id)
    .single();

  if (!role || role.org_id !== profile.org_id) notFound();

  const [rpRes, permsRes, smRes] = await Promise.all([
    supabase
      .from("role_permissions")
      .select("permission_key")
      .eq("role_id", id),
    supabase
      .from("permissions")
      .select("key, description")
      .order("key", { ascending: true }),
    supabase
      .from("site_members")
      .select(
        "profile_id, site_id, profile:profiles(id, full_name, email), site:sites(id, name)",
      )
      .eq("role_id", id),
  ]);

  const initialSelected = (rpRes.data ?? []).map((rp) => rp.permission_key);
  const catalog = (permsRes.data ?? []).map((p) => ({
    key: p.key,
    description: p.description,
  }));
  const memberships = smRes.data ?? [];
  const memberCount = memberships.length;

  const tabRaw = pickFirst(sp.tab);
  const tab: "permissions" | "members" =
    tabRaw === "members" ? "members" : "permissions";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/roles"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Roles
          </Link>
          <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold">
            <ShieldCheck className="h-6 w-6 text-primary" />
            {role.name}
            {role.is_default && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                System
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-[11px]">{role.key}</span>
            {" · "}
            {memberCount} member{memberCount === 1 ? "" : "s"} · created{" "}
            {format(new Date(role.created_at), "PP")}
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="Role sections" className="flex items-center gap-1 border-b">
        <TabLink
          href={`/admin/roles/${id}?tab=permissions`}
          label="Permissions"
          active={tab === "permissions"}
        />
        <TabLink
          href={`/admin/roles/${id}?tab=members`}
          label={`Members (${memberCount})`}
          active={tab === "members"}
        />
      </div>

      {tab === "permissions" ? (
        <RolePermissionsForm
          roleId={role.id}
          roleName={role.name}
          description={role.description}
          isSystemRole={role.is_default}
          catalog={catalog}
          initialSelected={initialSelected}
        />
      ) : (
        <MembersTab memberships={memberships} />
      )}

      {!role.is_default && tab === "permissions" && (
        <div className="flex justify-end border-t pt-4">
          <DeleteRoleDialog
            roleId={role.id}
            roleName={role.name}
            memberCount={memberCount}
            disabled={!canDelete}
          />
        </div>
      )}
      {/* Mark canEdit usage so future per-perm gating can attach without
          re-introducing it later. canEdit gates the Save button via the RPC
          today; the form renders for any role:read user but the action
          rejects without role:edit. */}
      {!canEdit && tab === "permissions" && (
        <p className="text-[11px] text-muted-foreground">
          Read-only — you don&apos;t have <span className="font-mono">role:edit</span>.
        </p>
      )}
    </div>
  );
}

function TabLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-current={active ? "page" : undefined}
      className={cn(
        "border-b-2 px-3 py-2 text-sm transition-colors",
        active
          ? "border-primary font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

type MembershipRow = {
  profile_id: string;
  site_id: string;
  profile: { id: string; full_name: string | null; email: string } | null;
  site: { id: string; name: string } | null;
};

function MembersTab({ memberships }: { memberships: MembershipRow[] }) {
  if (memberships.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        No members hold this role yet.
      </div>
    );
  }
  // Group by profile so we render each user once with the sites they hold.
  type Group = {
    profile_id: string;
    full_name: string | null;
    email: string;
    sites: { id: string; name: string }[];
  };
  const map = new Map<string, Group>();
  for (const m of memberships) {
    if (!m.profile) continue;
    const key = m.profile.id;
    const existing = map.get(key);
    const site = m.site ? { id: m.site.id, name: m.site.name } : null;
    if (existing) {
      if (site) existing.sites.push(site);
    } else {
      map.set(key, {
        profile_id: m.profile.id,
        full_name: m.profile.full_name,
        email: m.profile.email,
        sites: site ? [site] : [],
      });
    }
  }
  const groups = Array.from(map.values()).sort((a, b) => {
    const na = a.full_name ?? a.email;
    const nb = b.full_name ?? b.email;
    return na.localeCompare(nb);
  });

  return (
    <ul className="divide-y rounded-md border">
      {groups.map((g) => {
        const name = g.full_name ?? g.email;
        return (
          <li key={g.profile_id} className="flex items-center justify-between gap-3 px-3 py-2">
            <Link
              href={`/admin/members/${g.profile_id}`}
              className="flex min-w-0 items-center gap-2 hover:underline"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium">{name}</p>
                {g.full_name && (
                  <p className="truncate text-xs text-muted-foreground">{g.email}</p>
                )}
              </div>
            </Link>
            <p className="text-xs text-muted-foreground">
              {g.sites.length === 0
                ? "—"
                : g.sites.map((s) => s.name).slice(0, 3).join(", ")}
              {g.sites.length > 3 && ` +${g.sites.length - 3}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
