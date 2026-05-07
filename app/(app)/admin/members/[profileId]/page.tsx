import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Activity } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AddMemberDialog,
  type RoleOption,
} from "@/components/admin/add-member-dialog";
import {
  MemberMembershipsTable,
  type MembershipRow,
} from "@/components/admin/member-memberships-table";

type Params = Promise<{ profileId: string }>;

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Params;
}) {
  const { profileId } = await params;
  const { supabase, profile, currentSiteId } = await requireUser();

  if (!currentSiteId) redirect("/dashboard");

  // Gate at the org level — anyone with the right perm on the cookie site
  // can see the org-wide members surface (RLS still scopes the data).
  const [canConfigure, canInvite, canManage] = await Promise.all([
    can("site:configure", currentSiteId),
    can("member:invite", currentSiteId),
    can("member:manage", currentSiteId),
  ]);
  if (!canConfigure && !canInvite && !canManage) redirect("/admin");

  // Fetch profile, memberships, roles, sites, last-30d activity count.
  const [
    profileRes,
    membershipsRes,
    rolesRes,
    sitesRes,
    activityCountRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, department")
      .eq("id", profileId)
      .eq("org_id", profile.org_id)
      .single(),
    supabase
      .from("site_members")
      .select(
        `site_id, role_id, include_children, created_at,
         site:sites(id, name, archived_at),
         role:roles(id, key, name)`,
      )
      .eq("profile_id", profileId),
    supabase
      .from("roles")
      .select("id, key, name")
      .eq("org_id", profile.org_id)
      .order("name", { ascending: true }),
    supabase
      .from("sites")
      .select("id, name")
      .eq("org_id", profile.org_id)
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", profileId)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  if (profileRes.error || !profileRes.data) notFound();
  const target = profileRes.data;
  const memberships = membershipsRes.data ?? [];
  const roles: RoleOption[] = (rolesRes.data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
  }));
  const allOrgSites = sitesRes.data ?? [];
  const last30dActivity = activityCountRes.count ?? 0;

  // Compute "is_last_site_admin" per row by counting site_admin rows on each site.
  const memberSiteIds = memberships.map((m) => m.site_id);
  const adminCountBySite = new Map<string, number>();
  if (memberSiteIds.length > 0) {
    const { data: adminRows } = await supabase
      .from("site_members")
      .select("site_id, role:roles(key)")
      .in("site_id", memberSiteIds);
    for (const r of adminRows ?? []) {
      if (r.role?.key === "site_admin") {
        adminCountBySite.set(r.site_id, (adminCountBySite.get(r.site_id) ?? 0) + 1);
      }
    }
  }

  // Resolve which sites the acting admin can manage (`member:manage`). One
  // can() call per site (the helper short-circuits cheaply via the resolver).
  const canManageBySite = new Map<string, boolean>();
  await Promise.all(
    memberSiteIds.map(async (sid) => {
      canManageBySite.set(sid, await can("member:manage", sid));
    }),
  );

  const rows: MembershipRow[] = memberships
    .filter((m) => m.site && m.role)
    .map((m) => ({
      site_id: m.site_id,
      site_name: m.site!.name,
      site_archived_at: m.site!.archived_at,
      role_id: m.role!.id,
      role_key: m.role!.key,
      role_name: m.role!.name,
      include_children: m.include_children,
      created_at: m.created_at,
      is_last_site_admin:
        m.role!.key === "site_admin" &&
        (adminCountBySite.get(m.site_id) ?? 0) <= 1,
    }));

  // "+ Add to a site" candidate sites: only sites the acting admin can
  // manage, that the member isn't already on.
  const memberSiteIdSet = new Set(memberSiteIds);
  const candidateSites: Array<{ id: string; name: string }> = [];
  for (const s of allOrgSites) {
    if (memberSiteIdSet.has(s.id)) continue;
    const ok = await can("member:manage", s.id);
    if (ok) candidateSites.push({ id: s.id, name: s.name });
  }

  const name = target.full_name ?? target.email;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/members"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Members
        </Link>
        <div className="mt-2 flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold">{name}</h1>
            <p className="text-sm text-muted-foreground">{target.email}</p>
            {target.department && (
              <p className="text-xs text-muted-foreground">{target.department}</p>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Profile editing (name, email, department) lands in Phase 8 Settings.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Site memberships</h2>
          <AddMemberDialog
            mode="add-site-to-profile"
            profileId={profileId}
            candidates={candidateSites}
            roles={roles}
            triggerLabel="Add to a site"
            emptyCopy="This member is already on every site you can manage, or you don't have member:manage on any other site."
          />
        </div>
        <MemberMembershipsTable
          profileId={profileId}
          memberName={name}
          rows={rows}
          roles={roles}
          canManageBySite={canManageBySite}
        />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm">
            <span className="font-medium tabular-nums">{last30dActivity}</span>{" "}
            <span className="text-muted-foreground">
              activity events in the last 30 days
            </span>
          </p>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Useful "is this user active" signal. Full activity log is a future
          read-only view.
        </p>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
