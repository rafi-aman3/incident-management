import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { orgCan } from "@/lib/auth/orgCan";
import { isArgusAvailable } from "@/lib/argus/availability";
import { ArgusContextPayload } from "@/components/argus/argus-context";
import { ArgusInsightTile } from "@/components/argus/argus-insight-tile";
import { getOverdueInvestigationsTilePayload } from "@/lib/argus/tiles/overdue-investigations";
import { getStopWorkActiveTilePayload } from "@/lib/argus/tiles/stop-work-active";
import { getReportabilityUncertainTilePayload } from "@/lib/argus/tiles/reportability-uncertain";
import { getCapaOverdueTilePayload } from "@/lib/argus/tiles/capa-overdue";
import { SiteKpiStrip } from "@/components/dashboard/site-kpi-strip";
import { QuickActionsRow } from "@/components/dashboard/quick-actions-row";
import { ModuleCardsGrid } from "@/components/dashboard/module-cards-grid";
import { TrendsSection } from "@/components/dashboard/trends-section";
import { ActivityRow } from "@/components/dashboard/activity-row";
import { BottomRow } from "@/components/dashboard/bottom-row";
import type { ArgusPageContext } from "@/lib/argus/page-context";

type Params = Promise<{ id: string }>;

export default async function SiteDashboardPage({ params }: { params: Params }) {
  const { id: siteId } = await params;
  const { supabase, profile } = await requireUser();

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, org_id, setup_completed_at")
    .eq("id", siteId)
    .maybeSingle();
  if (!site || site.org_id !== profile.org_id) notFound();

  const canRead = await can("incident:read_site", siteId);
  if (!canRead) redirect("/dashboard");

  const [
    canReport,
    canInspect,
    canHazard,
    canCapa,
    canJsa,
    canBulletin,
    canInvestigationRead,
    canCapaRead,
    canReportRead,
    argusAvailable,
    overdueInv,
    stopWork,
    reportability,
    capaOverdue,
  ] = await Promise.all([
    can("incident:report", siteId),
    can("inspection:run", siteId),
    can("hazard:report", siteId),
    can("capa:create", siteId),
    can("jsa:draft", siteId),
    orgCan("bulletin:create"),
    can("investigation:lead", siteId),
    can("capa:complete", siteId),
    can("report:read", siteId),
    isArgusAvailable(profile.org_id),
    getOverdueInvestigationsTilePayload(supabase, siteId),
    getStopWorkActiveTilePayload(supabase, siteId),
    getReportabilityUncertainTilePayload(supabase, siteId),
    getCapaOverdueTilePayload(supabase, siteId),
  ]);

  const firstName =
    profile.full_name?.split(" ")[0] ?? profile.email.split("@")[0] ?? "there";

  const activeSignal =
    (overdueInv?.aggregates?.count ?? 0) > 0 ||
    (stopWork?.aggregates?.count ?? 0) > 0 ||
    (reportability?.aggregates?.count ?? 0) > 0 ||
    (capaOverdue?.aggregates?.count ?? 0) > 0;

  const argusContext: ArgusPageContext = {
    route: "unknown",
    routeLabel: `Site · ${site.name}`,
    siteId,
    siteLabel: site.name,
    aggregates: {},
    records: [],
    hasActiveSignal: argusAvailable && activeSignal,
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <ArgusContextPayload context={argusContext} />

        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to org dashboard
          </Link>
          <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
            Site dashboard
          </p>
          <h1 className="text-2xl font-semibold">{site.name}</h1>
          <p className="text-sm text-muted-foreground">
            Hi {firstName} — here&apos;s what&apos;s happening at this site.
          </p>
        </div>

        {!site.setup_completed_at && (
          <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <div className="flex-1">
              <strong className="font-semibold">Site setup in progress:</strong>{" "}
              <span className="text-muted-foreground">
                {site.name} hasn&apos;t finished site setup yet.
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

        <QuickActionsRow
          perms={{
            reportIncident: canReport,
            startInspection: canInspect,
            addHazard: canHazard,
            createCapa: canCapa,
            createJsa: canJsa,
            createBulletin: canBulletin,
          }}
          sites={[]}
          currentSiteId={siteId}
        />

        <SiteKpiStrip siteId={siteId} />

        {argusAvailable && (
          <div className="grid gap-3 md:grid-cols-2">
            {canInvestigationRead && overdueInv && (
              <ArgusInsightTile
                tile="overdue_investigations"
                payload={{ ...overdueInv, siteId }}
              />
            )}
            {canRead && stopWork && (
              <ArgusInsightTile tile="stop_work_active" payload={{ ...stopWork, siteId }} />
            )}
            {canReportRead && reportability && (
              <ArgusInsightTile
                tile="reportability_uncertain"
                payload={{ ...reportability, siteId }}
              />
            )}
            {canCapaRead && capaOverdue && (
              <ArgusInsightTile tile="capa_overdue" payload={{ ...capaOverdue, siteId }} />
            )}
          </div>
        )}

        <ModuleCardsGrid orgId={profile.org_id} siteId={siteId} />

        <TrendsSection orgId={profile.org_id} siteId={siteId} />

        <ActivityRow orgId={profile.org_id} siteId={siteId} />

        <BottomRow orgId={profile.org_id} siteId={siteId} userId={profile.id} />
      </div>
    </TooltipProvider>
  );
}
