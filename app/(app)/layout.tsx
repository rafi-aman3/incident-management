import { ReactNode, Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarShell } from "@/components/app-shell/sidebar-shell";
import { SIDEBAR_PINNED_COOKIE } from "@/components/app-shell/sidebar-cookie";
import { Topbar } from "@/components/app-shell/topbar";
import { RegulatoryBanner } from "@/components/app-shell/regulatory-banner";
import { StopWorkBanner, type ActiveStopWork } from "@/components/app-shell/stop-work-banner";
import { NAV_ITEMS, PINNED_NAV_HREFS, ROLE_BADGE } from "@/components/app-shell/nav-config";
import { ArgusContextProvider } from "@/components/argus/argus-context";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { orgCan } from "@/lib/auth/orgCan";
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

  // Phase 12 tab-crash recovery: profile + at least one site exists, but
  // onboarded_at is still null → user committed Step 1+2 of /onboarding
  // and lost their tab before Step 3 (or skipped invites by closing the
  // browser). Route them back to finish.
  if (profile.onboarded_at === null && memberships.length > 0) {
    redirect("/onboarding?step=invite");
  }

  // Permission-filter nav items server-side. resolvePermissions is
  // React.cache-memoized per request, so this is one round-trip total.
  const navChecks = await Promise.all(
    NAV_ITEMS.map(async (item) =>
      !item.permission || (await can(item.permission, currentSiteId))
    )
  );
  // Phase 17: also drop items the user has hidden via /settings/sidebar.
  // PINNED_NAV_HREFS short-circuit the hide list — even a stale value can't
  // remove dashboard/report-incident/admin from the rail.
  const hiddenSet = new Set(profile.sidebar_hidden_items ?? []);
  const allowedHrefs = NAV_ITEMS
    .filter((_, i) => navChecks[i])
    .filter((item) => PINNED_NAV_HREFS.has(item.href) || !hiddenSet.has(item.href))
    .map((i) => i.href);

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

  // Phase 17: silenced kinds (per-user). Pre-fetched so the bell + regulatory
  // banner share the same source of truth — life-safety kinds can't be
  // inserted via the UI, and the read-layer filter is defence-in-depth
  // against a hand-rolled DB insert that bypassed the action gate.
  const { data: silenceRows } = await supabase
    .from("user_notification_silences")
    .select("notification_kind")
    .eq("profile_id", profile.id);
  const silencedKinds = new Set(
    (silenceRows ?? []).map((r) => r.notification_kind as string)
  );

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
    notifications = (data ?? [])
      .filter((n) => !silencedKinds.has(n.kind as string))
      .map((n) => ({
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

  // Argus availability: org-flag AND user-permission AND key-configured.
  // Topbar hides the trigger when any of the three is false; route handler
  // enforces the same gates server-side.
  const [orgArgusFlag, userArgusPerm] = await Promise.all([
    supabase.from("orgs").select("argus_enabled").eq("id", profile.org_id).maybeSingle(),
    orgCan("argus:use"),
  ]);
  const argusEnabled = Boolean(orgArgusFlag.data?.argus_enabled) && userArgusPerm;

  // Active stop-works across the user's accessible sites. RLS already filters
  // incidents by site access; the .is(null) filter excludes acknowledged ones.
  const { data: stopWorkRows } = await supabase
    .from("incidents")
    .select("id, ref_code, title, stop_work_reason, stop_work_raised_at, stop_work_raised_by, site_id, sites:site_id(name)")
    .eq("stop_work", true)
    .is("stop_work_acknowledged_at", null)
    .order("stop_work_raised_at", { ascending: false })
    .limit(10);
  const activeStopWorks: ActiveStopWork[] = (stopWorkRows ?? []).map((r) => ({
    id: r.id,
    ref_code: r.ref_code,
    title: r.title,
    reason: r.stop_work_reason,
    raised_at: r.stop_work_raised_at,
    raised_by: r.stop_work_raised_by,
    site_id: r.site_id,
    site_name: r.sites?.name ?? null,
  }));

  return (
    <ArgusContextProvider>
      <SidebarShell
        defaultPinned={sidebarPinned}
        allowedHrefs={allowedHrefs}
        userLabel={fullName}
        roleLabel={roleLabel}
        sites={sites}
        currentSiteId={currentSiteId}
        canCreateSite={canCreateSite}
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
            argusEnabled={argusEnabled}
            argusPanelDefault={profile.argus_panel_default}
          />
        }
        banner={
          <>
            <RegulatoryBanner deadlines={notifications} />
            <StopWorkBanner active={activeStopWorks} />
          </>
        }
      >
        {children}
      </SidebarShell>
    </ArgusContextProvider>
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
