import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import {
  ASSET_CONDITIONS,
  ASSET_KINDS,
  type AssetCondition,
  type AssetKind,
  type AssetStatus,
} from "@/lib/documents/types";
import { AssetListFilters } from "@/components/assets/asset-list-filters";
import { AssetList, type AssetRow } from "@/components/assets/asset-list";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const KIND_VALUES = ASSET_KINDS as readonly string[];
const CONDITION_VALUES = ASSET_CONDITIONS as readonly string[];

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, profile, memberships } = await requireUser();

  // Capability checks scoped to the user's accessible sites.
  let canCreateAnywhere = false;
  for (const m of memberships) {
    if (await can("asset:create", m.site_id)) {
      canCreateAnywhere = true;
      break;
    }
  }

  // Filter parsing
  const siteParam = typeof sp.site === "string" ? sp.site : null;
  const kindParam =
    typeof sp.kind === "string" && KIND_VALUES.includes(sp.kind)
      ? (sp.kind as AssetKind)
      : null;
  const conditionParam =
    typeof sp.condition === "string" && CONDITION_VALUES.includes(sp.condition)
      ? (sp.condition as AssetCondition)
      : null;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  // Query — RLS already restricts to org + accessible sites.
  let query = supabase
    .from("assets")
    .select(
      `id, ref_code, name, kind, site_id, location, condition, status,
       last_inspected_at, next_pm_at, sds_document_id,
       site:sites!inner(id, name)`
    )
    .eq("org_id", profile.org_id)
    .is("deleted_at", null)
    .order("site_id", { ascending: true })
    .order("name", { ascending: true })
    .limit(500);

  if (siteParam) query = query.eq("site_id", siteParam);
  if (kindParam) query = query.eq("kind", kindParam);
  if (conditionParam) query = query.eq("condition", conditionParam);
  if (q) {
    const safe = q.replace(/[%_]/g, "");
    query = query.or(`name.ilike.%${safe}%,ref_code.ilike.%${safe}%,location.ilike.%${safe}%`);
  }

  const { data, error } = await query;

  type Joined = {
    id: string;
    ref_code: string;
    name: string;
    kind: AssetKind;
    site_id: string;
    location: string | null;
    condition: AssetCondition;
    status: AssetStatus;
    last_inspected_at: string | null;
    next_pm_at: string | null;
    sds_document_id: string | null;
    site: { id: string; name: string } | { id: string; name: string }[] | null;
  };

  const rows: AssetRow[] = ((data ?? []) as Joined[]).map((r) => {
    const site = Array.isArray(r.site) ? r.site[0] : r.site;
    return {
      id: r.id,
      ref_code: r.ref_code,
      name: r.name,
      kind: r.kind,
      site_id: r.site_id,
      site_name: site?.name ?? "(unknown site)",
      location: r.location,
      condition: r.condition,
      status: r.status,
      last_inspected_at: r.last_inspected_at,
      next_pm_at: r.next_pm_at,
      has_sds: r.sds_document_id != null,
    };
  });

  // Group by site (only when not site-filtered)
  const grouped = !siteParam
    ? rows.reduce<Record<string, AssetRow[]>>((acc, row) => {
        const key = row.site_id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      }, {})
    : null;

  // Site options for the filter dropdown — pull from memberships so the
  // user only sees sites they can access. Sort alphabetically.
  const siteOptions = memberships
    .map((m) => m.site)
    .filter((s): s is NonNullable<typeof s> => s != null)
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <Header />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <AssetListFilters sites={siteOptions} />

        {canCreateAnywhere && (
          <Link
            href="/resources/assets/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New asset
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {grouped && Object.keys(grouped).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(grouped).map(([siteId, siteRows]) => (
            <section key={siteId}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {siteRows[0]?.site_name ?? "(unknown site)"}
                <span className="ml-2 text-muted-foreground/70">
                  · {siteRows.length} asset{siteRows.length === 1 ? "" : "s"}
                </span>
              </h2>
              <AssetList rows={siteRows} />
            </section>
          ))}
        </div>
      ) : (
        <AssetList rows={rows} />
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Module 4 · Resources
      </p>
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Boxes className="h-6 w-6" />
        Assets
      </h1>
      <p className="text-sm text-muted-foreground">
        Per-site registry of operational assets — equipment, machinery, safety
        gear. Each asset can link to its SDS, maintenance log, and any
        incident, inspection, or CAPA that touched it.
      </p>
    </div>
  );
}
