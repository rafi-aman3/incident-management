import { Suspense } from "react";
import Link from "next/link";
import { Plus, AlertTriangle } from "lucide-react";
import { SiteCreatedToast } from "@/components/app-shell/site-created-toast";
import { InvitedToast } from "@/components/app-shell/invited-toast";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { WorkerWelcomeCard } from "@/components/onboarding/worker-welcome-card";
import { RoleWelcomeCard } from "@/components/onboarding/role-welcome-card";
import { ROLE_WELCOME_CONTENT } from "@/lib/onboarding/role-welcome-content";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/info-tooltip";
import type { TooltipKey } from "@/lib/constants/tooltips";
import { trir, dart, formatKpi, isDartCase } from "@/lib/format/kpi";
import { ArgusContextPayload } from "@/components/argus/argus-context";
import { ArgusInsightTile } from "@/components/argus/argus-insight-tile";
import { isArgusAvailable } from "@/lib/argus/availability";
import { getOverdueInvestigationsTilePayload } from "@/lib/argus/tiles/overdue-investigations";
import { getStopWorkActiveTilePayload } from "@/lib/argus/tiles/stop-work-active";
import { getReportabilityUncertainTilePayload } from "@/lib/argus/tiles/reportability-uncertain";
import { getCapaOverdueTilePayload } from "@/lib/argus/tiles/capa-overdue";
import { LatestBulletinsCard } from "@/components/dashboard/latest-bulletins-card";
import { SitesMapCard } from "@/components/dashboard/sites-map-card";
import type { ArgusPageContext } from "@/lib/argus/page-context";
import { getChecklistState, pickNextItems } from "@/lib/get-started/state";
import { GetStartedWidget } from "@/components/get-started/dashboard-widget";
import { orgCan } from "@/lib/auth/orgCan";

export default async function DashboardPage() {
  const { supabase, profile, currentMembership, currentSiteId, currentRoleKey } =
    await requireUser();

  // Site_admin viewing an unfinished site sees a yellow banner above the
  // dashboard with a "Finish setup" link. We do NOT force-redirect into the
  // wizard — the user explicitly wants to land on the dashboard after
  // creating a site, and trapping them on the wizard makes the just-created
  // site invisible from the topbar SiteSwitcher and KPI strip.
  let setupIncompleteSiteName: string | null = null;
  if (currentSiteId && currentRoleKey === "site_admin") {
    const { data: currentSite } = await supabase
      .from("sites")
      .select("name, setup_completed_at")
      .eq("id", currentSiteId)
      .maybeSingle();
    if (currentSite && !currentSite.setup_completed_at) {
      setupIncompleteSiteName = currentSite.name;
    }
  }

  const canReportIncident = currentSiteId ? await can("incident:report", currentSiteId) : false;

  // ----- Argus tiles availability + permissions -----
  // Tiles render only when:
  //   - org has argus_enabled AND user has argus:use
  //   - the per-tile read permission is granted on any accessible site (orgCan)
  //   - the aggregator returned a payload (org-wide fan-out when siteId is null)
  const [
    argusAvailable,
    canInvestigationRead,
    canCapaRead,
    canReportRead,
    canStopWorkRead,
    overdueInvPayload,
    stopWorkPayload,
    reportabilityPayload,
    capaOverduePayload,
    isOrgAdmin,
    checklistState,
  ] = await Promise.all([
    isArgusAvailable(profile.org_id),
    orgCan("investigation:lead"),
    orgCan("capa:complete"),
    orgCan("report:read"),
    orgCan("incident:read_site"),
    getOverdueInvestigationsTilePayload(supabase, null),
    getStopWorkActiveTilePayload(supabase, null),
    getReportabilityUncertainTilePayload(supabase, null),
    getCapaOverdueTilePayload(supabase, null),
    orgCan("org:configure"),
    getChecklistState({ orgId: profile.org_id, userId: profile.id }),
  ]);

  const showGetStartedWidget =
    isOrgAdmin && checklistState.doneCount < checklistState.totalCount;
  const nextItems = showGetStartedWidget ? pickNextItems(checklistState, 3) : [];

  // ----- Live KPIs for the current calendar year -----
  // Open / S1+S2 are true site-wide counts via head:true count queries;
  // TRIR / DART pull recordable cases joined to injured_persons + reads
  // site_annual_hours. Returns null (rendered "—") when hours not set.
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  const orgId = profile.org_id;
  const [recentRes, openRes, s1s2Res, recordableRes, sitesRes] = await Promise.all([
    supabase
      .from("incidents")
      .select("id, ref_code, type, title, severity, track, status, occurred_at")
      .eq("org_id", orgId)
      .eq("is_sandbox", false)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(5),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_sandbox", false)
      .is("deleted_at", null)
      .neq("status", "closed"),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_sandbox", false)
      .is("deleted_at", null)
      .in("severity", ["S1", "S2"])
      .neq("status", "closed"),
    supabase
      .from("incidents")
      .select("id, injured_persons(days_away, days_restricted, fatality)")
      .eq("org_id", orgId)
      .eq("osha_recordable", true)
      .eq("is_sandbox", false)
      .is("deleted_at", null)
      .gte("occurred_at", yearStart)
      .lt("occurred_at", yearEnd),
    supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .not("setup_completed_at", "is", null),
  ]);
  const recentIncidents = recentRes.data ?? [];
  const openCount = openRes.count ?? 0;
  const s1s2Count = s1s2Res.count ?? 0;
  const incs = recordableRes.data ?? [];
  const recordableCases = incs.length;
  const dartCases = incs.filter((inc) =>
    (inc.injured_persons ?? []).some((p) =>
      isDartCase({ days_away: p.days_away, days_restricted: p.days_restricted }),
    ),
  ).length;
  const activeSitesCount = sitesRes.count ?? 0;

  // TRIR/DART hours — sum across sites in the org with annual hours for the year
  const hoursRes = await supabase
    .from("site_annual_hours")
    .select("hours_worked, site:sites!inner(org_id)")
    .eq("year", year)
    .eq("site.org_id", orgId);
  const hoursWorked = (hoursRes.data ?? []).reduce(
    (sum, row) => sum + (row.hours_worked ?? 0),
    0,
  ) || null;

  const kpiCards: Array<{
    label: string;
    value: string;
    tip: TooltipKey | null;
    hint: string;
    emphasis?: boolean;
  }> = [
    {
      label: "Active sites",
      value: String(activeSitesCount),
      tip: null,
      hint: activeSitesCount === 0 ? "Create your first site" : "Setup completed",
      emphasis: true,
    },
    {
      label: "Open incidents",
      value: String(openCount),
      tip: null,
      hint: "Not yet closed",
    },
    {
      label: "S1 / S2 open",
      value: String(s1s2Count),
      tip: "severity_codes",
      hint: "Track A — full investigation",
    },
    {
      label: `TRIR (${year})`,
      value: formatKpi(trir(recordableCases, hoursWorked)),
      tip: "trir_dart_formula",
      hint: hoursWorked
        ? `${recordableCases} recordable / ${(hoursWorked / 1000).toFixed(0)}k hr`
        : "No annual hours set on any site",
    },
    {
      label: `DART (${year})`,
      value: formatKpi(dart(dartCases, hoursWorked)),
      tip: "trir_dart_formula",
      hint: hoursWorked ? `${dartCases} DART case${dartCases === 1 ? "" : "s"}` : "No annual hours set on any site",
    },
  ];

  const showWelcome = profile.seen_welcome === false;
  const firstName =
    profile.full_name?.split(" ")[0] ?? profile.email.split("@")[0] ?? "there";

  const dashboardActiveSignal =
    (overdueInvPayload?.aggregates?.count ?? 0) > 0 ||
    (stopWorkPayload?.aggregates?.count ?? 0) > 0 ||
    (reportabilityPayload?.aggregates?.count ?? 0) > 0 ||
    (capaOverduePayload?.aggregates?.count ?? 0) > 0;

  const argusContext: ArgusPageContext = {
    route: "dashboard",
    routeLabel: "Dashboard",
    siteId: currentSiteId,
    siteLabel: currentMembership?.site?.name ?? null,
    aggregates: {
      open_incidents: openCount,
      s1_s2_open: s1s2Count,
      recordable_ytd: recordableCases,
      dart_ytd: dartCases,
    },
    records: recentIncidents.slice(0, 5).map((inc) => ({
      kind: "incident" as const,
      id: inc.id,
      refCode: inc.ref_code,
      title: inc.severity ? `${inc.severity} ${inc.type}` : inc.type,
    })),
    hasActiveSignal: argusAvailable && dashboardActiveSignal,
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <ArgusContextPayload context={argusContext} />
        <Suspense fallback={null}>
          <SiteCreatedToast />
          <InvitedToast />
        </Suspense>
        {setupIncompleteSiteName && (
          <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <div className="flex-1">
              <strong className="font-semibold">Site setup in progress:</strong>{" "}
              <span className="text-muted-foreground">
                {setupIncompleteSiteName} hasn&apos;t finished site setup yet.
              </span>{" "}
              <Link
                href="/admin/site-setup"
                className="font-medium text-primary hover:underline"
              >
                Finish setup →
              </Link>
            </div>
          </div>
        )}

        {showGetStartedWidget && (
          <GetStartedWidget
            rows={nextItems}
            doneCount={checklistState.doneCount}
            totalCount={checklistState.totalCount}
          />
        )}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Dashboard</p>
            <h1 className="text-2xl font-semibold">Hi, {firstName}</h1>
            <p className="text-sm text-muted-foreground">
              A live picture of incidents, inspections, and risk across your sites.
            </p>
          </div>
          {canReportIncident && (
            <Link
              href="/incidents/new/1"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Report incident
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpiCards.map((c) => (
            <div
              key={c.label}
              className={
                c.emphasis
                  ? "rounded-md border border-primary/30 bg-primary/5 p-4"
                  : "rounded-md border bg-card p-4"
              }
            >
              <div className="flex items-center text-xs uppercase tracking-wide text-muted-foreground">
                {c.label}
                {c.tip && <InfoTooltip tip={c.tip} />}
              </div>
              <div
                className={
                  c.emphasis
                    ? "mt-2 text-2xl font-semibold tabular-nums text-primary"
                    : "mt-2 text-2xl font-semibold tabular-nums"
                }
              >
                {c.value}
              </div>
              <div className="text-xs text-muted-foreground">{c.hint}</div>
            </div>
          ))}
        </div>

        <SitesMapCard orgId={profile.org_id} />

        {argusAvailable && (
          <div className="grid gap-3 md:grid-cols-2">
            {canInvestigationRead && overdueInvPayload && (
              <ArgusInsightTile
                tile="overdue_investigations"
                payload={{ ...overdueInvPayload, siteId: null }}
              />
            )}
            {canStopWorkRead && stopWorkPayload && (
              <ArgusInsightTile
                tile="stop_work_active"
                payload={{ ...stopWorkPayload, siteId: null }}
              />
            )}
            {canReportRead && reportabilityPayload && (
              <ArgusInsightTile
                tile="reportability_uncertain"
                payload={{ ...reportabilityPayload, siteId: null }}
              />
            )}
            {canCapaRead && capaOverduePayload && (
              <ArgusInsightTile
                tile="capa_overdue"
                payload={{ ...capaOverduePayload, siteId: null }}
              />
            )}
          </div>
        )}

        <LatestBulletinsCard />

        {!currentSiteId && (
          <section className="rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">No sites yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first site to start capturing incidents, running inspections, and rolling up reports.
            </p>
            <Link
              href="/admin/sites/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Create your first site
            </Link>
          </section>
        )}

        {showWelcome && currentRoleKey === "worker" && (
          <WorkerWelcomeCard firstName={firstName} />
        )}
        {showWelcome && currentRoleKey !== "worker" && (
          <RoleWelcomeCard
            firstName={firstName}
            content={ROLE_WELCOME_CONTENT[currentRoleKey]}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
