import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import {
  INVESTIGATION_STATUSES,
  type InvestigationStatus,
} from "@/lib/investigations/types";
import { KanbanBoard } from "@/components/investigations/kanban-board";
import { InvestigationsList } from "@/components/investigations/investigations-list";
import { InvestigationFilters } from "@/components/investigations/investigation-filters";
import type { InvestigationCardData } from "@/components/investigations/investigation-card-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SEVERITIES = ["S1", "S2", "S3", "S4", "S5"] as const;

export default async function InvestigationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, currentSiteId } = await requireUser();

  const view = sp.view === "list" ? "list" : "kanban";
  const severityFilter = typeof sp.severity === "string" ? sp.severity : null;
  const statusFilter = typeof sp.status === "string" ? sp.status : null;

  const canAccess = currentSiteId ? await can("incident:read_site", currentSiteId) : false;

  let rows: InvestigationCardData[] = [];
  let queryError: string | null = null;

  if (canAccess && currentSiteId) {
    let query = supabase
      .from("investigations")
      .select(
        `id, ref_code, status, due_date, started_at,
         lead:lead_investigator_id ( id, full_name, email ),
         incident:incident_id ( id, ref_code, title, severity, track, is_sandbox )`
      )
      .is("deleted_at", null)
      .eq("site_id", currentSiteId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (statusFilter && (INVESTIGATION_STATUSES as readonly string[]).includes(statusFilter)) {
      query = query.eq("status", statusFilter as InvestigationStatus);
    }

    const { data, error } = await query;
    if (error) {
      queryError = error.message;
    } else {
      const filtered = (data ?? []).filter((r) => {
        const inc = r.incident;
        if (!inc) return false;
        if (inc.is_sandbox) return false; // sandbox excluded per project rules
        if (
          severityFilter &&
          (SEVERITIES as readonly string[]).includes(severityFilter) &&
          inc.severity !== severityFilter
        ) {
          return false;
        }
        return true;
      });
      rows = filtered.map((r) => ({
        id: r.id,
        ref_code: r.ref_code,
        status: r.status as InvestigationStatus,
        due_date: r.due_date,
        started_at: r.started_at,
        lead: r.lead ?? null,
        incident: {
          id: r.incident!.id,
          ref_code: r.incident!.ref_code,
          title: r.incident!.title,
          severity: r.incident!.severity as InvestigationCardData["incident"]["severity"],
          track: r.incident!.track as InvestigationCardData["incident"]["track"],
        },
      }));
    }
  }

  const columns: Record<InvestigationStatus, InvestigationCardData[]> = {
    pending_assignment: [],
    in_progress: [],
    awaiting_capa: [],
    closed: [],
  };
  for (const r of rows) columns[r.status].push(r);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Module 2</p>
        <h1 className="text-2xl font-semibold">Investigations</h1>
        <p className="text-sm text-muted-foreground">
          RCA + evidence + findings for every Track A and Track B incident.
        </p>
      </div>

      <InvestigationFilters
        current={{ severity: severityFilter, status: statusFilter, view }}
      />

      {queryError && <p className="text-sm text-destructive">{queryError}</p>}
      {!canAccess && (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          You don&apos;t have access to investigations on this site.
        </div>
      )}

      {canAccess && rows.length === 0 && !queryError && (
        <div className="rounded-md border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">No investigations yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Investigations are auto-created when an incident is classified S1–S3.
          </p>
        </div>
      )}

      {canAccess &&
        rows.length > 0 &&
        (view === "list" ? (
          <InvestigationsList rows={rows} />
        ) : (
          <KanbanBoard initialColumns={columns} />
        ))}
    </div>
  );
}
