import Link from "next/link";
import { Play } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { InspectionList, type InspectionRow } from "@/components/inspections/inspection-list";
import { InspectionListFilters } from "@/components/inspections/inspection-list-filters";
import {
  StartInspectionDialog,
  type StartTemplateOption,
} from "@/components/inspections/start-inspection-dialog";
import { ArgusContextPayload } from "@/components/argus/argus-context";
import { ArgusInsightTile } from "@/components/argus/argus-insight-tile";
import { isArgusAvailable } from "@/lib/argus/availability";
import { getInspectionsDueSummaryTilePayload } from "@/lib/argus/tiles/inspections-due-summary";
import type { ArgusPageContext } from "@/lib/argus/page-context";
import type { InspectionStatus } from "@/lib/templates/types";
import type { IndustryEnum } from "@/lib/templates/industry-map";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_VALUES: ReadonlyArray<InspectionStatus> = [
  "draft",
  "in_progress",
  "completed",
  "abandoned",
];

type InspectionRowQuery = {
  id: string;
  ref_code: string;
  title: string;
  status: InspectionStatus;
  is_failed: boolean;
  conducted_at: string | null;
  template: { name: string } | { name: string }[] | null;
  inspector: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
};

type AssignmentRow = {
  id: string;
  template_id: string;
  template:
    | { id: string; name: string; description: string | null; industry: IndustryEnum; status: string }
    | { id: string; name: string; description: string | null; industry: IndustryEnum; status: string }[]
    | null;
};

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, profile, currentSiteId } = await requireUser();

  const canRead = currentSiteId ? await can("inspection:read_site", currentSiteId) : false;
  const canStart = currentSiteId ? await can("inspection:start", currentSiteId) : false;

  // Filters
  const statusParam =
    typeof sp.status === "string" &&
    (STATUS_VALUES as readonly string[]).includes(sp.status)
      ? (sp.status as InspectionStatus)
      : null;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const templateParam =
    typeof sp.template === "string" && sp.template.length > 0
      ? sp.template
      : null;

  let rows: InspectionRow[] = [];

  if (canRead && currentSiteId) {
    let query = supabase
      .from("inspections")
      .select(
        `id, ref_code, title, status, is_failed, conducted_at,
         template:templates ( name ),
         inspector:inspector_id ( full_name, email )`
      )
      .eq("site_id", currentSiteId)
      .is("deleted_at", null)
      .order("conducted_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (statusParam) query = query.eq("status", statusParam);
    if (templateParam) query = query.eq("template_id", templateParam);
    if (q) query = query.ilike("title", `%${q}%`);
    const { data, error } = await query.returns<InspectionRowQuery[]>();
    if (error) throw error;
    rows = (data ?? []).map((r) => {
      const tmpl = Array.isArray(r.template) ? r.template[0] : r.template;
      const ins = Array.isArray(r.inspector) ? r.inspector[0] : r.inspector;
      return {
        id: r.id,
        ref_code: r.ref_code,
        title: r.title,
        template_name: tmpl?.name ?? null,
        status: r.status,
        is_failed: r.is_failed,
        conducted_at: r.conducted_at,
        inspector: ins ?? null,
      };
    });
  }

  // Templates available for "Start Inspection" — filter by:
  //   - assignments at the current site (active)
  //   - template status = 'published'
  let startOptions: StartTemplateOption[] = [];
  if (canStart && currentSiteId) {
    const { data: assignments } = await supabase
      .from("template_assignments")
      .select(
        `id, template_id,
         template:templates ( id, name, description, industry, status )`
      )
      .eq("site_id", currentSiteId)
      .is("unassigned_at", null)
      .returns<AssignmentRow[]>();
    const seen = new Set<string>();
    const collected: StartTemplateOption[] = [];
    for (const a of assignments ?? []) {
      const t = Array.isArray(a.template) ? a.template[0] : a.template;
      if (!t) continue;
      if (t.status !== "published") continue;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      collected.push({
        id: t.id,
        name: t.name,
        industry: t.industry,
        description: t.description,
        assignment_id: a.id,
      });
    }
    startOptions = collected;
  }

  const argusContext: ArgusPageContext = {
    route: "inspections_index",
    routeLabel: "Inspections",
    siteId: currentSiteId,
    aggregates: {
      visible_rows: rows.length,
      failed: rows.filter((r) => r.is_failed).length,
      in_progress: rows.filter((r) => r.status === "in_progress").length,
      assignable_templates: startOptions.length,
    },
    records: rows.slice(0, 5).map((r) => ({
      kind: "inspection" as const,
      id: r.id,
      refCode: r.ref_code,
      title: `${r.status}${r.is_failed ? " · failed" : ""}`,
    })),
  };

  const [argusAvailable, inspectionsTilePayload] = await Promise.all([
    isArgusAvailable(profile.org_id),
    canRead ? getInspectionsDueSummaryTilePayload(supabase, currentSiteId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <ArgusContextPayload context={argusContext} />
      {argusAvailable && canRead && currentSiteId && inspectionsTilePayload && (
        <ArgusInsightTile
          tile="inspections_due_summary"
          payload={{ ...inspectionsTilePayload, siteId: currentSiteId }}
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inspections</h1>
          <p className="text-sm text-muted-foreground">
            Run a checklist on the floor. Failed responses become findings —
            review them, mark resolved, or escalate to an incident.
          </p>
        </div>
        {canStart && (
          <Link
            href="/inspections?action=start"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Play className="h-4 w-4" /> Start inspection
          </Link>
        )}
      </div>

      <InspectionListFilters />

      {!canRead && (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          You don&apos;t have access to inspections at this site.
        </div>
      )}

      {canRead && (
        <section aria-label="Inspections">
          <InspectionList rows={rows} />
        </section>
      )}

      <StartInspectionDialog options={startOptions} siteId={currentSiteId} />
    </div>
  );
}
