import { AlertTriangle, SearchX } from "lucide-react";
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

type SiteRow = {
  id: string;
  name: string;
  parent_site_id: string | null;
};

function pickFirst(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return "";
}

/** BFS site-tree expansion: same approach the planner uses. */
function resolveAccessibleSites(
  allSites: SiteRow[],
  memberships: ReadonlyArray<{ site_id: string; include_children: boolean }>,
): SiteRow[] {
  const byParent = new Map<string | null, SiteRow[]>();
  for (const s of allSites) {
    const arr = byParent.get(s.parent_site_id) ?? [];
    arr.push(s);
    byParent.set(s.parent_site_id, arr);
  }
  const accessible = new Set<string>();
  for (const m of memberships) {
    if (accessible.has(m.site_id)) continue;
    accessible.add(m.site_id);
    if (m.include_children) {
      const queue = [m.site_id];
      while (queue.length > 0) {
        const sid = queue.shift()!;
        for (const child of byParent.get(sid) ?? []) {
          if (!accessible.has(child.id)) {
            accessible.add(child.id);
            queue.push(child.id);
          }
        }
      }
    }
  }
  return allSites.filter((s) => accessible.has(s.id));
}

export default async function InvestigationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, user, profile, memberships, currentSiteId } = await requireUser();

  const view = sp.view === "list" ? "list" : "kanban";
  const severityFilter = pickFirst(sp.severity) || null;
  const statusFilter = pickFirst(sp.status) || null;
  const siteParam = pickFirst(sp.site); // "", "all", or a site_id
  const leadParam = pickFirst(sp.lead); // "", "me", "unassigned", or a profile_id

  // ---- Accessible sites + tree expansion (mirrors planner pattern) ----
  const { data: orgSites } = await supabase
    .from("sites")
    .select("id, name, parent_site_id")
    .eq("org_id", profile.org_id)
    .order("name", { ascending: true });

  const accessibleSites = resolveAccessibleSites(
    (orgSites ?? []) as SiteRow[],
    memberships.map((m) => ({
      site_id: m.site_id,
      include_children: m.include_children,
    })),
  );

  // Resolve which siteIds the query restricts to.
  let filterSiteIds: string[];
  if (siteParam === "all") {
    filterSiteIds = accessibleSites.map((s) => s.id);
  } else if (siteParam !== "" && accessibleSites.some((s) => s.id === siteParam)) {
    filterSiteIds = [siteParam];
  } else {
    filterSiteIds = currentSiteId ? [currentSiteId] : [];
  }

  // Permission gate: must hold incident:read_site on at least one accessible
  // site. RLS still enforces per-site access on the actual rows.
  const canAccess =
    filterSiteIds.length > 0
      ? (await Promise.all(filterSiteIds.map((sid) => can("incident:read_site", sid)))).some(Boolean)
      : false;

  let rows: InvestigationCardData[] = [];
  let queryError: string | null = null;

  if (canAccess && filterSiteIds.length > 0) {
    let query = supabase
      .from("investigations")
      .select(
        `id, ref_code, status, due_date, started_at, lead_investigator_id, site_id,
         site:site_id ( id, name ),
         lead:lead_investigator_id ( id, full_name, email ),
         incident:incident_id ( id, ref_code, title, severity, track, is_sandbox )`
      )
      .is("deleted_at", null)
      .in("site_id", filterSiteIds)
      .order("created_at", { ascending: false })
      .limit(200);

    if (statusFilter && (INVESTIGATION_STATUSES as readonly string[]).includes(statusFilter)) {
      query = query.eq("status", statusFilter as InvestigationStatus);
    }

    if (leadParam === "me") {
      query = query.eq("lead_investigator_id", user.id);
    } else if (leadParam === "unassigned") {
      query = query.is("lead_investigator_id", null);
    } else if (leadParam) {
      query = query.eq("lead_investigator_id", leadParam);
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
        lead_investigator_id: r.lead_investigator_id ?? null,
        site_id: r.site_id,
        site_name: r.site?.name ?? null,
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

  // Distinct leads from the current rows — populates the lead filter dropdown.
  const leadOptions = Array.from(
    new Map(
      rows
        .filter((r) => r.lead)
        .map((r) => [r.lead!.id, r.lead!]),
    ).values(),
  ).sort((a, b) =>
    (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email),
  );

  // Capability for "Assign me" CTA — gated server-side too in the action.
  const canSelfAssign =
    filterSiteIds.length > 0
      ? (await Promise.all(filterSiteIds.map((sid) => can("investigation:lead", sid)))).some(Boolean)
      : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Investigations</h1>
        <p className="text-sm text-muted-foreground">
          RCA + evidence + findings for every Track A and Track B incident.
        </p>
      </div>

      <InvestigationFilters
        current={{
          severity: severityFilter,
          status: statusFilter,
          site: siteParam,
          lead: leadParam,
          view,
        }}
        sites={accessibleSites}
        leads={leadOptions}
        currentUserId={user.id}
      />

      {queryError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">We couldn&apos;t load investigations</p>
            <p className="text-muted-foreground">{queryError}</p>
          </div>
        </div>
      )}

      {!canAccess && !queryError && (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          You don&apos;t have access to investigations on this site.
        </div>
      )}

      {canAccess && rows.length === 0 && !queryError && (
        <div className="rounded-md border border-dashed p-12 text-center">
          <SearchX className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">No investigations match these filters</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Investigations are auto-created when an incident is classified S1–S3.
            Reset your filters to see anything in flight.
          </p>
        </div>
      )}

      {canAccess &&
        rows.length > 0 &&
        (view === "list" ? (
          <InvestigationsList rows={rows} />
        ) : (
          <KanbanBoard
            initialColumns={columns}
            canSelfAssign={canSelfAssign}
            currentUser={{
              id: user.id,
              full_name: profile.full_name,
              email: profile.email,
            }}
          />
        ))}
    </div>
  );
}
