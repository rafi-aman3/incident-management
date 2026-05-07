import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, ArrowLeft, Info } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { MembersFilters } from "@/components/admin/members-filters";
import { MembersList, type MemberRow } from "@/components/admin/members-list";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFirst(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return "";
}

const ROLE_PRIORITY: Record<string, number> = {
  site_admin: 4,
  ehs_manager: 3,
  supervisor: 2,
  worker: 1,
};

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, profile, currentSiteId } = await requireUser();

  if (!currentSiteId) redirect("/dashboard");

  // Gate: any of site:configure / member:invite / member:manage on at least
  // the current site is enough to see the org-wide member list. The list
  // itself is org-scoped via RLS.
  const [canConfigure, canInvite, canManage] = await Promise.all([
    can("site:configure", currentSiteId),
    can("member:invite", currentSiteId),
    can("member:manage", currentSiteId),
  ]);
  if (!canConfigure && !canInvite && !canManage) redirect("/admin");

  const roleParam = pickFirst(sp.role);
  const siteParam = pickFirst(sp.site);
  const q = pickFirst(sp.q).trim();

  const [profilesRes, sitesRes, rolesRes, membershipsRes] = await Promise.all([
    (() => {
      let qb = supabase
        .from("profiles")
        .select("id, full_name, email, department")
        .eq("org_id", profile.org_id)
        .order("full_name", { ascending: true });
      if (q) {
        qb = qb.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
      }
      return qb;
    })(),
    supabase
      .from("sites")
      .select("id, name")
      .eq("org_id", profile.org_id)
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("roles")
      .select("id, key, name")
      .eq("org_id", profile.org_id)
      .order("name", { ascending: true }),
    supabase
      .from("site_members")
      .select(
        "profile_id, site_id, role:roles(id, key, name), site:sites(org_id)",
      ),
  ]);

  const profilesRaw = profilesRes.data ?? [];
  const sites = sitesRes.data ?? [];
  const roles = rolesRes.data ?? [];

  // Build per-profile aggregates from the memberships query.
  type Memb = { site_id: string; role_id: string; role_key: string; role_name: string };
  const byProfile = new Map<string, Memb[]>();
  for (const m of membershipsRes.data ?? []) {
    if (!m.role) continue;
    const list = byProfile.get(m.profile_id) ?? [];
    list.push({
      site_id: m.site_id,
      role_id: m.role.id,
      role_key: m.role.key,
      role_name: m.role.name,
    });
    byProfile.set(m.profile_id, list);
  }

  // Last-seen via activity_events.actor_id MAX(created_at). One query, then
  // join in TS so we don't fan out N queries.
  const profileIds = profilesRaw.map((p) => p.id);
  const lastSeenMap = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: actRows } = await supabase
      .from("activity_events")
      .select("actor_id, created_at")
      .in("actor_id", profileIds)
      .order("created_at", { ascending: false })
      .limit(2000);
    for (const row of actRows ?? []) {
      if (!row.actor_id || lastSeenMap.has(row.actor_id)) continue;
      lastSeenMap.set(row.actor_id, row.created_at);
    }
  }

  // Build rows + apply role/site filters in TS (after the joins).
  let rows: MemberRow[] = profilesRaw.map((p) => {
    const ms = byProfile.get(p.id) ?? [];
    const primary = ms
      .slice()
      .sort(
        (a, b) =>
          (ROLE_PRIORITY[b.role_key] ?? 0) - (ROLE_PRIORITY[a.role_key] ?? 0),
      )[0];
    return {
      profile_id: p.id,
      full_name: p.full_name,
      email: p.email,
      department: p.department,
      sites_count: ms.length,
      primary_role_name: primary?.role_name ?? null,
      last_seen_at: lastSeenMap.get(p.id) ?? null,
    };
  });

  if (roleParam) {
    rows = rows.filter((r) =>
      (byProfile.get(r.profile_id) ?? []).some((m) => m.role_id === roleParam),
    );
  }
  if (siteParam) {
    rows = rows.filter((r) =>
      (byProfile.get(r.profile_id) ?? []).some((m) => m.site_id === siteParam),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Admin
          </Link>
          <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold">
            <Users className="h-6 w-6 text-primary" /> Members
          </h1>
          <p className="text-sm text-muted-foreground">
            {profilesRaw.length} member{profilesRaw.length === 1 ? "" : "s"} in
            this org.
          </p>
        </div>
        <InvitePlaceholderInfo />
      </div>

      <MembersFilters
        current={{ role: roleParam, site: siteParam, q }}
        roles={roles.map((r) => ({ id: r.id, name: r.name, key: r.key }))}
        sites={sites}
      />

      <MembersList rows={rows} />
    </div>
  );
}

function InvitePlaceholderInfo() {
  return (
    <div className="max-w-sm rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs">
      <p className="flex items-center gap-1 font-medium">
        <Info className="h-3 w-3" /> Email invitations ship in Phase 11c.
      </p>
      <p className="text-muted-foreground">
        To add an existing colleague, open a site and use the Members tab.
      </p>
    </div>
  );
}
