import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type RecentAssetRow = {
  id: string;
  name: string;
  kind: string | null;
  site_name: string | null;
  created_at: string;
};

export async function getRecentAssets(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
  limit = 5,
): Promise<RecentAssetRow[]> {
  let q = supabase
    .from("assets")
    .select("id, name, kind, created_at, site:sites!inner(name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (siteId) q = q.eq("site_id", siteId);
  else q = q.eq("org_id", orgId!);
  const { data } = await q;
  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    kind: string | null;
    created_at: string;
    site: { name: string } | null;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind ?? null,
    site_name: r.site?.name ?? null,
    created_at: r.created_at,
  }));
}
