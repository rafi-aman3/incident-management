import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import {
  SitesFilters,
  type SitesFilterState,
} from "@/components/admin/sites-filters";
import { SitesList, type SiteRow } from "@/components/admin/sites-list";
import { SiteHierarchyTree } from "@/components/admin/site-hierarchy-tree";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFirst(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return "";
}

export default async function AdminSitesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, profile, currentSiteId } = await requireUser();

  if (!currentSiteId) redirect("/dashboard");

  const canConfigure = await can("site:configure", currentSiteId);
  if (!canConfigure) redirect("/admin");
  const canArchive = await can("site:archive", currentSiteId);

  // ---- searchParams ----
  const statusRaw = pickFirst(sp.status);
  const status: SitesFilterState["status"] =
    statusRaw === "archived" || statusRaw === "all" ? statusRaw : "active";
  const countryRaw = pickFirst(sp.country).toUpperCase();
  const country: SitesFilterState["country"] =
    countryRaw === "US" || countryRaw === "GB" ? (countryRaw as "US" | "GB") : "all";
  const q = pickFirst(sp.q).trim();
  const view: SitesFilterState["view"] =
    pickFirst(sp.view) === "tree" ? "tree" : "table";

  // ---- query ----
  let query = supabase
    .from("sites")
    .select(
      `id, name, country, region, parent_site_id, archived_at, setup_completed_at,
       parent:parent_site_id (name)`,
    )
    .eq("org_id", profile.org_id)
    .order("name", { ascending: true });

  if (status === "active") query = query.is("archived_at", null);
  if (status === "archived") query = query.not("archived_at", "is", null);
  if (country !== "all") query = query.eq("country", country);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data: rawSites, error: sitesErr } = await query;

  // Per-site member counts and last-incident dates run in parallel.
  const siteIds = (rawSites ?? []).map((s) => s.id);
  const [memberCountsRes, lastIncidentsRes] = await Promise.all([
    siteIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ site_id: string }> })
      : supabase
          .from("site_members")
          .select("site_id")
          .in("site_id", siteIds),
    siteIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ site_id: string; occurred_at: string }> })
      : supabase
          .from("incidents")
          .select("site_id, occurred_at")
          .in("site_id", siteIds)
          .is("deleted_at", null)
          .order("occurred_at", { ascending: false }),
  ]);

  const memberCountBySite = new Map<string, number>();
  for (const m of memberCountsRes.data ?? []) {
    memberCountBySite.set(m.site_id, (memberCountBySite.get(m.site_id) ?? 0) + 1);
  }
  const lastIncidentBySite = new Map<string, string>();
  for (const i of lastIncidentsRes.data ?? []) {
    if (!lastIncidentBySite.has(i.site_id))
      lastIncidentBySite.set(i.site_id, i.occurred_at);
  }

  const rows: SiteRow[] = (rawSites ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    country: s.country,
    region: s.region,
    parent_site_id: s.parent_site_id,
    parent_name: s.parent?.name ?? null,
    archived_at: s.archived_at,
    setup_completed_at: s.setup_completed_at,
    member_count: memberCountBySite.get(s.id) ?? 0,
    last_incident_at: lastIncidentBySite.get(s.id) ?? null,
  }));

  const activeCount = rows.filter((r) => r.archived_at === null).length;
  const archivedCount = rows.length - activeCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            ← Admin
          </Link>
          <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold">
            <Building2 className="h-6 w-6 text-primary" /> Sites
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} active · {archivedCount} archived
          </p>
        </div>
        <Link
          href="/admin/sites/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add site
        </Link>
      </div>

      <SitesFilters current={{ status, country, q, view }} />

      {sitesErr && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">We couldn&apos;t load sites</p>
          <p className="text-muted-foreground">{sitesErr.message}</p>
        </div>
      )}

      {!sitesErr &&
        (view === "tree" ? (
          <SiteHierarchyTree rows={rows} />
        ) : (
          <SitesList rows={rows} canArchive={canArchive} />
        ))}
    </div>
  );
}
