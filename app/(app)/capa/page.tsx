import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import {
  ACTIVE_STATUSES,
  CAPA_TABS,
  CLOSED_STATUSES,
  type CapaStatus,
  type CapaTabKey,
} from "@/lib/capa/types";

const ACTIVE_ENUM = ACTIVE_STATUSES as ReadonlyArray<CapaStatus>;
const CLOSED_ENUM = CLOSED_STATUSES as ReadonlyArray<CapaStatus>;
import { CapaKpiStrip, type CapaKpiCounts } from "@/components/capa/capa-kpi-strip";
import { CapaTabs } from "@/components/capa/capa-tabs";
import { CapaList, type CapaRow } from "@/components/capa/capa-list";
import { CapaFilters } from "@/components/capa/capa-filters";
import {
  CapaCreateModal,
  type CapaCreateMember,
} from "@/components/capa/capa-create-modal";
import { ArgusContextPayload } from "@/components/argus/argus-context";
import { ArgusInsightTile } from "@/components/argus/argus-insight-tile";
import { isArgusAvailable } from "@/lib/argus/availability";
import { getCapaIndexSummaryTilePayload } from "@/lib/argus/tiles/capa-index-summary";
import type { ArgusPageContext } from "@/lib/argus/page-context";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const VALID_TABS: ReadonlyArray<CapaTabKey> = CAPA_TABS.map((t) => t.key);

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

/** BFS site-tree expansion: same approach the planner + investigations use. */
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

export default async function CapaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, user, profile, memberships, currentSiteId } = await requireUser();

  const tab: CapaTabKey =
    typeof sp.tab === "string" && (VALID_TABS as readonly string[]).includes(sp.tab)
      ? (sp.tab as CapaTabKey)
      : "mine";

  const siteParam = pickFirst(sp.site); // "", "all", or a site_id
  const ownerParam = pickFirst(sp.owner); // "", or a profile_id

  const canCreate = currentSiteId ? await can("capa:create", currentSiteId) : false;
  const canRead = currentSiteId ? await can("capa:complete", currentSiteId) : false;

  const today = new Date().toISOString().slice(0, 10);

  // ---- Accessible sites + tree expansion (mirrors planner + investigations) ----
  const { data: orgSites } = await supabase
    .from("sites")
    .select("id, name, parent_site_id")
    .eq("org_id", profile.org_id)
    .is("archived_at", null)
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

  let counts: CapaKpiCounts = {
    active: 0,
    pendingVerification: 0,
    overdue: 0,
    closed: 0,
  };
  let tabCounts: Partial<Record<CapaTabKey, number>> = {};
  let rows: CapaRow[] = [];
  let queryError: string | null = null;
  let members: CapaCreateMember[] = [];
  let owners: Array<{ id: string; full_name: string | null; email: string }> = [];

  if (canCreate && currentSiteId) {
    const { data: siteMembersRaw } = await supabase
      .from("site_members")
      .select("profile:profiles ( id, full_name, email )")
      .eq("site_id", currentSiteId);
    members = (siteMembersRaw ?? [])
      .filter((m) => m.profile)
      .map((m) => ({
        id: m.profile!.id,
        full_name: m.profile!.full_name,
        email: m.profile!.email,
      }));
  }

  // Owners list for the filter dropdown — distinct profiles holding any role
  // on any of the accessible sites.
  if (canRead && filterSiteIds.length > 0) {
    const { data: ownerRows } = await supabase
      .from("site_members")
      .select("profile:profiles ( id, full_name, email )")
      .in("site_id", filterSiteIds);
    const seen = new Set<string>();
    for (const m of ownerRows ?? []) {
      if (!m.profile || seen.has(m.profile.id)) continue;
      seen.add(m.profile.id);
      owners.push({
        id: m.profile.id,
        full_name: m.profile.full_name,
        email: m.profile.email,
      });
    }
    owners.sort((a, b) =>
      (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email),
    );
  }

  if (canRead && filterSiteIds.length > 0) {
    // Helper builds a base query with the resolved site filter + owner filter
    // applied, so KPIs and tab counts respect the active filter chips.
    const base = () => {
      let q = supabase
        .from("capas")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("site_id", filterSiteIds);
      if (ownerParam) q = q.eq("owner_id", ownerParam);
      return q;
    };

    // KPI counts (head-only) + tab counts
    const [activeRes, pendingRes, overdueRes, closedRes, mineRes, allRes] =
      await Promise.all([
        base().in("status", ACTIVE_ENUM),
        base().eq("status", "pending_verification"),
        base()
          .not("status", "in", `(${CLOSED_STATUSES.join(",")})`)
          .lt("due_date", today),
        base().in("status", CLOSED_ENUM),
        base().eq("owner_id", user.id),
        base(),
      ]);
    counts = {
      active: activeRes.count ?? 0,
      pendingVerification: pendingRes.count ?? 0,
      overdue: overdueRes.count ?? 0,
      closed: closedRes.count ?? 0,
    };
    tabCounts = {
      mine: mineRes.count ?? 0,
      active: counts.active,
      pending_verification: counts.pendingVerification,
      overdue: counts.overdue,
      closed: counts.closed,
      all: allRes.count ?? 0,
    };

    // Rows for the active tab
    let q = supabase
      .from("capas")
      .select(
        `id, ref_code, type, title, status, progress_pct, due_date,
         owner:profiles!owner_id ( full_name, email ),
         verifier:profiles!verifier_id ( full_name, email )`
      )
      .is("deleted_at", null)
      .in("site_id", filterSiteIds)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(200);

    if (ownerParam) q = q.eq("owner_id", ownerParam);

    if (tab === "mine") {
      q = q.eq("owner_id", user.id);
    } else if (tab === "active") {
      q = q.in("status", ACTIVE_ENUM);
    } else if (tab === "pending_verification") {
      q = q.eq("status", "pending_verification");
    } else if (tab === "overdue") {
      q = q
        .not("status", "in", `(${CLOSED_STATUSES.join(",")})`)
        .lt("due_date", today);
    } else if (tab === "closed") {
      q = q.in("status", CLOSED_ENUM);
    }

    const { data, error } = await q;
    if (error) {
      queryError = error.message;
    } else {
      rows = (data ?? []).map((r) => {
        const status = r.status as CapaStatus;
        const overdue =
          !!r.due_date &&
          r.due_date < today &&
          !(CLOSED_STATUSES as readonly string[]).includes(status);
        return {
          id: r.id,
          ref_code: r.ref_code,
          type: r.type as CapaRow["type"],
          title: r.title,
          status,
          progress_pct: r.progress_pct ?? 0,
          due_date: r.due_date,
          owner: r.owner ?? null,
          verifier: r.verifier ?? null,
          is_overdue: overdue,
        };
      });
    }
  }

  const [argusAvailable, capaIndexPayload] = await Promise.all([
    isArgusAvailable(profile.org_id),
    canRead ? getCapaIndexSummaryTilePayload(supabase, currentSiteId) : Promise.resolve(null),
  ]);

  const argusContext: ArgusPageContext = {
    route: "capa_index",
    routeLabel: "CAPA",
    siteId: currentSiteId,
    aggregates: {
      active: counts.active,
      pending_verification: counts.pendingVerification,
      overdue: counts.overdue,
      closed: counts.closed,
    },
    records: rows.slice(0, 5).map((r) => ({
      kind: "capa" as const,
      id: r.id,
      refCode: r.ref_code,
      title: `${r.type} · ${r.status}${r.is_overdue ? " · overdue" : ""}`,
    })),
    hasActiveSignal:
      argusAvailable && counts.overdue + counts.pendingVerification > 0,
  };

  return (
    <div className="space-y-6">
      <ArgusContextPayload context={argusContext} />
      {argusAvailable && canRead && currentSiteId && capaIndexPayload && (
        <ArgusInsightTile
          tile="capa_index_summary"
          payload={{ ...capaIndexPayload, siteId: currentSiteId }}
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">CAPA</h1>
          <p className="text-sm text-muted-foreground">
            Corrective and preventive actions. Owner ≠ verifier — enforced at UI,
            server, and database.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/capa?action=create"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New CAPA
          </Link>
        )}
      </div>

      {canRead && <CapaKpiStrip counts={counts} />}
      {canRead && (
        <CapaTabs
          current={tab}
          counts={tabCounts}
          params={{ site: siteParam, owner: ownerParam }}
        />
      )}
      {canRead && (
        <CapaFilters
          current={{ site: siteParam, owner: ownerParam, tab }}
          sites={accessibleSites.map((s) => ({ id: s.id, name: s.name }))}
          owners={owners}
          currentUserId={user.id}
        />
      )}

      {!canRead && (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          You don&apos;t have access to CAPAs on this site.
        </div>
      )}

      {queryError && <p className="text-sm text-destructive">{queryError}</p>}

      {canRead && !queryError && <CapaList rows={rows} currentTab={tab} />}

      {canCreate && (
        <CapaCreateModal members={members} context={{ kind: "standalone" }} />
      )}
    </div>
  );
}
