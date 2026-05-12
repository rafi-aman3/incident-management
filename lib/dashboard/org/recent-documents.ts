import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * `documents` columns: name (not title), type (not doc_type), uploaded_at
 * (treated as recency cursor), site_id (nullable — org-wide if NULL), and
 * archived_at for soft-archive. Render uses `uploaded_at` since `documents`
 * has no `created_at` column.
 */

export type RecentDocumentRow = {
  id: string;
  name: string;
  type: string | null;
  site_name: string | null;
  uploaded_at: string;
};

export async function getRecentDocuments(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  siteId: string | null,
  limit = 5,
): Promise<RecentDocumentRow[]> {
  let q = supabase
    .from("documents")
    .select("id, name, type, uploaded_at, site:sites(name)")
    .is("archived_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(limit);
  if (siteId) q = q.eq("site_id", siteId);
  else q = q.eq("org_id", orgId!);
  const { data } = await q;
  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    type: string | null;
    uploaded_at: string;
    site: { name: string } | null;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type ?? null,
    site_name: r.site?.name ?? null,
    uploaded_at: r.uploaded_at,
  }));
}
