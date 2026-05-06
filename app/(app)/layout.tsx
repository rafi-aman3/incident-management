import { ReactNode, Suspense } from "react";
import { cookies } from "next/headers";
import { SidebarShell } from "@/components/app-shell/sidebar-shell";
import { SIDEBAR_PINNED_COOKIE } from "@/components/app-shell/sidebar-cookie";
import { Topbar } from "@/components/app-shell/topbar";
import { RegulatoryBanner } from "@/components/app-shell/regulatory-banner";
import { NAV_ITEMS, ROLE_BADGE } from "@/components/app-shell/nav-config";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import type { NotificationItem } from "@/components/app-shell/notification-bell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

async function AppShell({ children }: { children: ReactNode }) {
  const { profile, memberships, currentMembership, currentSiteId, currentRoleKey, supabase } =
    await requireUser();

  // Permission-filter nav items server-side. resolvePermissions is
  // React.cache-memoized per request, so this is one round-trip total.
  const navChecks = await Promise.all(
    NAV_ITEMS.map(async (item) =>
      !item.permission || (await can(item.permission, currentSiteId))
    )
  );
  const allowedHrefs = NAV_ITEMS.filter((_, i) => navChecks[i]).map((i) => i.href);

  const sites = memberships
    .map((m) =>
      m.site
        ? { id: m.site.id, name: m.site.name, country: m.site.country }
        : null
    )
    .filter((s): s is { id: string; name: string; country: "US" | "GB" } => s !== null);

  // Mirror create_site_v1's gating: bootstrap (zero memberships) OR holds
  // site_admin somewhere. Keeps the "Create new site" affordance off the
  // dropdown for users who'd just bounce off the destination.
  const canCreateSite =
    memberships.length === 0 ||
    memberships.some((m) => m.role?.key === "site_admin");

  // Raw site_members read (bypasses the membership join's RLS-on-sites
  // filter) so we can tell whether memberships are truly absent vs. being
  // hidden because the embedded sites read failed.
  const { data: rawMembers, error: rawErr } = await supabase
    .from("site_members")
    .select("site_id, role_id")
    .eq("profile_id", profile.id);

  console.log("[AppShell]", {
    auth_uid: profile.id,
    profile_email: profile.email,
    profile_org_id: profile.org_id,
    memberships_via_join: memberships.length,
    raw_site_members_for_this_uid: rawMembers?.length ?? 0,
    raw_query_error: rawErr?.message ?? null,
    sites_visible_in_switcher: sites.length,
    sites: sites.map((s) => `${s.name} (${s.country})`),
    current_site_id: currentSiteId,
    current_role: currentRoleKey,
    can_create_site: canCreateSite,
  });

  let notifications: NotificationItem[] = [];
  if (currentSiteId) {
    // Bell shows: site-wide regulatory deadlines (recipient_id NULL) +
    // notifications addressed to the current user (CAPA owner/verifier
    // assignments, escalations).
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, deadline_at, incident_id, capa_id, recipient_id, created_at")
      .eq("site_id", currentSiteId)
      .is("resolved_at", null)
      .or(`recipient_id.is.null,recipient_id.eq.${profile.id}`)
      .order("deadline_at", { ascending: true })
      .limit(20);
    notifications = (data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      deadline_at: n.deadline_at,
      incident_id: n.incident_id,
      capa_id: n.capa_id,
      created_at: n.created_at,
    }));
  }

  const fullName = profile.full_name ?? profile.email;
  const roleLabel = ROLE_BADGE[currentRoleKey].label;

  const cookieStore = await cookies();
  const sidebarPinned = cookieStore.get(SIDEBAR_PINNED_COOKIE)?.value === "true";

  return (
    <SidebarShell
      defaultPinned={sidebarPinned}
      allowedHrefs={allowedHrefs}
      userLabel={fullName}
      roleLabel={roleLabel}
      topbar={
        <Topbar
          sites={sites}
          currentSiteId={currentSiteId}
          canCreateSite={canCreateSite}
          notifications={notifications}
          fullName={fullName}
          email={profile.email}
          roleLabel={roleLabel}
          roleKey={currentRoleKey}
          currentSiteName={currentMembership?.site?.name ?? null}
        />
      }
      banner={<RegulatoryBanner deadlines={notifications} />}
    >
      {children}
    </SidebarShell>
  );
}

function AppShellFallback() {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-[60px] shrink-0 border-r bg-sidebar p-2 md:block">
        <Skeleton className="mx-auto mb-4 h-8 w-8 rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mx-auto h-8 w-8 rounded-md" />
          ))}
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b px-4">
          <Skeleton className="h-6 w-40" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </header>
        <main className="flex-1 px-6 py-6">
          <Skeleton className="h-32 w-full" />
        </main>
      </div>
    </div>
  );
}
