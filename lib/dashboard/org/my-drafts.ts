import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Draft sources the dashboard surfaces as "Resume →":
 *   - incidents the user reported and left in `status='draft'`
 *   - inspections the user is the inspector or assignee for that are still
 *     `in_progress`
 *
 * Templates were originally on this list but `template_versions` has no
 * `created_by` column (only `published_by`, and drafts have no publisher),
 * so we can't reliably attribute draft templates to a user. Plan's fallback
 * note authorized dropping the template branch.
 */

export type DraftRow = {
  kind: "incident" | "inspection";
  id: string;
  label: string;
  href: string;
  updated_at: string;
};

export async function getMyDrafts(
  supabase: SupabaseClient<Database>,
  userId: string,
  orgId: string,
  siteId: string | null,
): Promise<DraftRow[]> {
  let qI = supabase
    .from("incidents")
    .select("id, ref_code, title, updated_at")
    .eq("reporter_id", userId)
    .eq("status", "draft")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (siteId) qI = qI.eq("site_id", siteId);
  else qI = qI.eq("org_id", orgId);

  // Inspections: include both inspector_id and assignee membership. RLS
  // already scopes by org/site visibility, so the union is safe.
  let qInspInspector = supabase
    .from("inspections")
    .select("id, ref_code, title, updated_at")
    .eq("inspector_id", userId)
    .eq("status", "in_progress")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (siteId) qInspInspector = qInspInspector.eq("site_id", siteId);
  else qInspInspector = qInspInspector.eq("org_id", orgId);

  let qInspAssignee = supabase
    .from("inspections")
    .select(
      "id, ref_code, title, updated_at, inspection_assignees!inner(profile_id)",
    )
    .eq("inspection_assignees.profile_id", userId)
    .eq("status", "in_progress")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);
  if (siteId) qInspAssignee = qInspAssignee.eq("site_id", siteId);
  else qInspAssignee = qInspAssignee.eq("org_id", orgId);

  const [inc, inspA, inspB] = await Promise.all([qI, qInspInspector, qInspAssignee]);

  const out: DraftRow[] = [];

  (inc.data ?? []).forEach((r) => {
    out.push({
      kind: "incident",
      id: r.id,
      label: r.title ?? `${r.ref_code ?? "Incident"} (draft)`,
      href: `/incidents/new/1?id=${r.id}`,
      updated_at: r.updated_at,
    });
  });

  const seenInsp = new Set<string>();
  const pushInsp = (r: { id: string; ref_code: string | null; title: string | null; updated_at: string }) => {
    if (seenInsp.has(r.id)) return;
    seenInsp.add(r.id);
    out.push({
      kind: "inspection",
      id: r.id,
      label: r.title ?? `${r.ref_code ?? "Inspection"} (in progress)`,
      href: `/inspections/${r.id}`,
      updated_at: r.updated_at,
    });
  };
  (inspA.data ?? []).forEach(pushInsp);
  (inspB.data ?? []).forEach(pushInsp);

  return out
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 8);
}
