import Link from "next/link";
import { ArrowRight, FileText, FileBarChart, FileCheck, Flag } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { ArgusContextPayload } from "@/components/argus/argus-context";
import type { ArgusPageContext } from "@/lib/argus/page-context";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportsLandingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, currentSiteId, memberships } = await requireUser();

  const yearParam = typeof sp.year === "string" ? Number(sp.year) : NaN;
  const year = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  const canRead = currentSiteId ? await can("incident:read_site", currentSiteId) : false;

  // Site jurisdiction — RIDDOR card hidden when no GB sites visible.
  const hasGbSite = memberships.some((m) => m.site?.country === "GB");
  const currentSite = memberships.find((m) => m.site_id === currentSiteId);
  const isCurrentSiteGb = currentSite?.site?.country === "GB";

  // Counts (head-only)
  let oshaRecordableCount = 0;
  let osha301PendingCount = 0;
  let riddorCount = 0;
  if (canRead && currentSiteId) {
    const [recordableRes, pendingRes, riddorRes] = await Promise.all([
      supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("site_id", currentSiteId)
        .eq("osha_recordable", true)
        .eq("is_sandbox", false)
        .is("deleted_at", null)
        .gte("occurred_at", yearStart)
        .lt("occurred_at", yearEnd),
      // 301 "pending" = OSHA-recordable AND occurred in the last 7 days (the
      // 7-day form deadline). A real implementation tracks form-completion
      // separately; for v1 the count surfaces upcoming deadlines.
      supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("site_id", currentSiteId)
        .eq("osha_recordable", true)
        .eq("is_sandbox", false)
        .is("deleted_at", null)
        .gte(
          "occurred_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        ),
      isCurrentSiteGb
        ? supabase
            .from("incidents")
            .select("id", { count: "exact", head: true })
            .eq("site_id", currentSiteId)
            .eq("riddor_reportable", true)
            .eq("is_sandbox", false)
            .is("deleted_at", null)
            .gte("occurred_at", yearStart)
            .lt("occurred_at", yearEnd)
        : { count: 0 },
    ]);
    oshaRecordableCount = recordableRes.count ?? 0;
    osha301PendingCount = pendingRes.count ?? 0;
    riddorCount = riddorRes.count ?? 0;
  }

  const argusContext: ArgusPageContext = {
    route: "reports_index",
    routeLabel: `Reports · ${year}`,
    siteId: currentSiteId,
    aggregates: {
      year,
      osha_recordable_ytd: oshaRecordableCount,
      osha_301_pending: osha301PendingCount,
      riddor_ytd: riddorCount,
      gb_sites_visible: hasGbSite ? 1 : 0,
    },
    records: [],
  };

  return (
    <div className="space-y-6">
      <ArgusContextPayload context={argusContext} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            OSHA and RIDDOR paperwork generated live from the incident database.
          </p>
        </div>
        <YearPicker current={year} />
      </div>

      {!canRead && (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          You don&apos;t have access to reports on this site.
        </div>
      )}

      {canRead && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ReportCard
            icon={FileBarChart}
            title="OSHA 300 Log"
            href={`/reports/osha-300?year=${year}`}
            metric={`${oshaRecordableCount} recordable case${oshaRecordableCount === 1 ? "" : "s"} YTD`}
            body="Running log of work-related injuries and illnesses (columns A–M). Updated within 7 calendar days; retained 5 years."
            cta="Open log"
          />
          <ReportCard
            icon={FileText}
            title="OSHA 300A Annual Summary"
            href={`/reports/osha-300a?year=${year}`}
            metric="Posting period: Feb 1 – Apr 30"
            body="Annual totals + TRIR / DART / Severity Rate. ITA submission deadline: March 2."
            cta="Open summary"
          />
          <ReportCard
            icon={FileCheck}
            title="OSHA 301 reports"
            href={`/incidents?year=${year}&recordable=1`}
            metric={`${osha301PendingCount} from last 7 days`}
            body="Per-incident detail (18 fields). Must complete within 7 days of the event."
            cta="Browse recordable incidents"
          />
          {hasGbSite && (
            <ReportCard
              icon={Flag}
              title="RIDDOR F2508"
              href={`/incidents?year=${year}&riddor=1`}
              metric={
                isCurrentSiteGb
                  ? `${riddorCount} reportable case${riddorCount === 1 ? "" : "s"} YTD`
                  : "GB sites only"
              }
              body="UK event-triggered HSE report. Death / specified injury → phone immediate + written 10 days."
              cta="Browse RIDDOR-reportable"
              dimmed={!isCurrentSiteGb}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  icon: Icon,
  title,
  href,
  metric,
  body,
  cta,
  dimmed,
}: {
  icon: typeof FileText;
  title: string;
  href: string;
  metric: string;
  body: string;
  cta: string;
  dimmed?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-lg border bg-card p-5 transition-colors hover:border-primary ${dimmed ? "opacity-60" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <Icon className="h-5 w-5 text-primary" />
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs font-medium text-primary">{metric}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <p className="mt-3 text-xs font-medium text-foreground">{cta} →</p>
    </Link>
  );
}

function YearPicker({ current }: { current: number }) {
  const now = new Date().getFullYear();
  const years = [now, now - 1, now - 2, now - 3];
  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5 text-xs">
      {years.map((y) => (
        <Link
          key={y}
          href={`/reports?year=${y}`}
          className={`rounded px-2 py-1 font-medium tabular-nums ${
            y === current ? "bg-primary text-primary-foreground" : "hover:bg-accent"
          }`}
        >
          {y}
        </Link>
      ))}
    </div>
  );
}
