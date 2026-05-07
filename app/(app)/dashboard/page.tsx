import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ArrowRight, AlertTriangle } from "lucide-react";
import { SiteCreatedToast } from "@/components/app-shell/site-created-toast";
import { InvitedToast } from "@/components/app-shell/invited-toast";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { INCIDENT_TYPE_META, type IncidentType } from "@/lib/incidents/types";
import { SeverityBadge, TrackBadge, StatusBadge } from "@/components/incidents/badges";
import { WorkerWelcomeCard } from "@/components/onboarding/worker-welcome-card";
import {
  RoleWelcomeCard,
  ROLE_WELCOME_CONTENT,
} from "@/components/onboarding/role-welcome-card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/info-tooltip";
import type { TooltipKey } from "@/lib/constants/tooltips";
import { trir, dart, formatKpi, isDartCase } from "@/lib/format/kpi";

export default async function DashboardPage() {
  const { supabase, profile, currentSiteId, currentRoleKey } = await requireUser();

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
  const canReadSite = currentSiteId ? await can("incident:read_site", currentSiteId) : false;

  // ----- Live KPIs for the current calendar year -----
  // Open / S1+S2 are true site-wide counts via head:true count queries;
  // TRIR / DART pull recordable cases joined to injured_persons + reads
  // site_annual_hours. Returns null (rendered "—") when hours not set.
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  let recentIncidents: Array<{
    id: string;
    ref_code: string | null;
    type: string;
    title: string | null;
    severity: string | null;
    track: string | null;
    status: string | null;
    occurred_at: string | null;
  }> = [];
  let openCount = 0;
  let s1s2Count = 0;
  let recordableCases = 0;
  let dartCases = 0;
  let hoursWorked: number | null = null;

  if (canReadSite && currentSiteId) {
    const [recentRes, openRes, s1s2Res, recordableRes, hoursRes] = await Promise.all([
      supabase
        .from("incidents")
        .select("id, ref_code, type, title, severity, track, status, occurred_at")
        .eq("site_id", currentSiteId)
        .eq("is_sandbox", false)
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false })
        .limit(5),
      supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("site_id", currentSiteId)
        .eq("is_sandbox", false)
        .is("deleted_at", null)
        .neq("status", "closed"),
      supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("site_id", currentSiteId)
        .eq("is_sandbox", false)
        .is("deleted_at", null)
        .in("severity", ["S1", "S2"])
        .neq("status", "closed"),
      supabase
        .from("incidents")
        .select("id, injured_persons(days_away, days_restricted, fatality)")
        .eq("site_id", currentSiteId)
        .eq("osha_recordable", true)
        .eq("is_sandbox", false)
        .is("deleted_at", null)
        .gte("occurred_at", yearStart)
        .lt("occurred_at", yearEnd),
      supabase
        .from("site_annual_hours")
        .select("hours_worked")
        .eq("site_id", currentSiteId)
        .eq("year", year)
        .maybeSingle(),
    ]);
    recentIncidents = recentRes.data ?? [];
    openCount = openRes.count ?? 0;
    s1s2Count = s1s2Res.count ?? 0;
    const incs = recordableRes.data ?? [];
    recordableCases = incs.length;
    dartCases = incs.filter((inc) =>
      (inc.injured_persons ?? []).some((p) =>
        isDartCase({ days_away: p.days_away, days_restricted: p.days_restricted })
      )
    ).length;
    hoursWorked = hoursRes.data?.hours_worked ?? null;
  }

  const kpiCards: Array<{
    label: string;
    value: string;
    tip: TooltipKey | null;
    hint: string;
  }> = [
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
        : "Set annual hours on the 300A",
    },
    {
      label: `DART (${year})`,
      value: formatKpi(dart(dartCases, hoursWorked)),
      tip: "trir_dart_formula",
      hint: hoursWorked ? `${dartCases} DART case${dartCases === 1 ? "" : "s"}` : "Set annual hours on the 300A",
    },
  ];

  const showWelcome = profile.seen_welcome === false;
  const firstName =
    profile.full_name?.split(" ")[0] ?? profile.email.split("@")[0] ?? "there";

  return (
    <TooltipProvider>
      <div className="space-y-6">
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

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Dashboard</p>
            <h1 className="text-2xl font-semibold">Hi, {firstName}</h1>
            <p className="text-sm text-muted-foreground">
              Site-scoped activity, regulatory clocks, and quick actions.
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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpiCards.map((c) => (
            <div key={c.label} className="rounded-md border bg-card p-4">
              <div className="flex items-center text-xs uppercase tracking-wide text-muted-foreground">
                {c.label}
                {c.tip && <InfoTooltip tip={c.tip} />}
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.hint}</div>
            </div>
          ))}
        </div>

        {canReadSite && (
          <section className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b p-3">
              <h2 className="text-sm font-semibold">Recent incidents</h2>
              <Link
                href="/incidents"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {recentIncidents.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No incidents yet — when reports come in, they show up here.
                </p>
                {canReportIncident && (
                  <Link
                    href="/incidents/new/1"
                    className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    <Plus className="h-3 w-3" /> Report your first incident
                  </Link>
                )}
              </div>
            ) : (
              <ul className="divide-y">
                {recentIncidents.map((row) => {
                  const meta = INCIDENT_TYPE_META[row.type as IncidentType];
                  const TypeIcon = meta?.icon;
                  return (
                    <li key={row.id} className="flex items-center justify-between gap-4 px-3 py-2.5">
                      <Link
                        href={`/incidents/${row.id}`}
                        className="flex flex-1 items-center gap-3 hover:underline"
                      >
                        {TypeIcon && <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{row.title}</div>
                          <div className="font-mono text-[10px] uppercase text-muted-foreground">
                            {row.ref_code} · {meta?.label}
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={row.severity ?? null} />
                        <TrackBadge track={row.track ?? null} />
                        <StatusBadge status={row.status ?? "draft"} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {!canReadSite && canReportIncident && (
          <section className="rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">Reporting starts here</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Saw something? Report it. Reporting takes about 3 minutes and stays confidential.
            </p>
            <Link
              href="/incidents/new/1"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Start a report
            </Link>
          </section>
        )}

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
