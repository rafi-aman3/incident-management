import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ArrowRight } from "lucide-react";
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
import { trir, dart, formatKpi, isDartCase } from "@/lib/format/kpi";

export default async function DashboardPage() {
  const { supabase, profile, currentSiteId, currentRoleKey } = await requireUser();

  // Site admins with un-set-up sites get sent to the wizard
  if (currentSiteId && currentRoleKey === "site_admin") {
    const { data: site } = await supabase
      .from("sites")
      .select("setup_completed_at")
      .eq("id", currentSiteId)
      .single();
    if (!site?.setup_completed_at) redirect("/admin/site-setup");
  }

  const canReportIncident = currentSiteId ? await can("incident:report", currentSiteId) : false;
  const canReadSite = currentSiteId ? await can("incident:read_site", currentSiteId) : false;

  // Recent incidents (sandbox excluded)
  const recentIncidents = canReadSite
    ? (
        await supabase
          .from("incidents")
          .select("id, ref_code, type, title, severity, track, status, occurred_at")
          .eq("site_id", currentSiteId!)
          .eq("is_sandbox", false)
          .is("deleted_at", null)
          .order("occurred_at", { ascending: false })
          .limit(5)
      ).data ?? []
    : [];

  // ----- Live KPIs (TRIR / DART) for the current calendar year -----
  // Pulls recordable cases joined to injured_persons; reads annual hours
  // from site_annual_hours. Returns null (rendered "—") when hours not set.
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  let recordableCases = 0;
  let dartCases = 0;
  let hoursWorked: number | null = null;

  if (canReadSite && currentSiteId) {
    const [recordableRes, hoursRes] = await Promise.all([
      supabase
        .from("incidents")
        .select(
          "id, injured_persons(days_away, days_restricted, fatality)"
        )
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
    const incs = recordableRes.data ?? [];
    recordableCases = incs.length;
    dartCases = incs.filter((inc) =>
      (inc.injured_persons ?? []).some((p) =>
        isDartCase({ days_away: p.days_away, days_restricted: p.days_restricted })
      )
    ).length;
    hoursWorked = hoursRes.data?.hours_worked ?? null;
  }

  const kpiCards: {
    label: string;
    value: string;
    tip: "severity_codes" | null;
    hint: string;
  }[] = [
    {
      label: "Open incidents",
      value: String(recentIncidents.filter((i) => i.status !== "closed").length),
      tip: null,
      hint: "Site-scoped count",
    },
    {
      label: "S1 / S2 (Track A)",
      value: String(
        recentIncidents.filter((i) => i.severity === "S1" || i.severity === "S2").length
      ),
      tip: "severity_codes",
      hint: "From the last 5 reports",
    },
    {
      label: `TRIR (${year})`,
      value: formatKpi(trir(recordableCases, hoursWorked)),
      tip: null,
      hint: hoursWorked
        ? `${recordableCases} recordable / ${(hoursWorked / 1000).toFixed(0)}k hr`
        : "Set annual hours on the 300A",
    },
    {
      label: `DART (${year})`,
      value: formatKpi(dart(dartCases, hoursWorked)),
      tip: null,
      hint: hoursWorked ? `${dartCases} DART case${dartCases === 1 ? "" : "s"}` : "Set annual hours on the 300A",
    },
  ];

  const showWelcome = profile.seen_welcome === false;
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Dashboard</p>
            <h1 className="text-2xl font-semibold">
              Hi, {profile.full_name?.split(" ")[0] ?? profile.email}
            </h1>
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
              <div className="p-8 text-center text-sm text-muted-foreground">
                No incidents yet — when reports come in, they show up here.
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
