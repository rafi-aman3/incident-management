import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * activity_events stores subjects as per-entity FK columns
 * (incident_id / investigation_id / capa_id / template_id / inspection_id /
 * finding_id / asset_id / document_id / document_link_id / jsa_id).
 * `subject_kind` is derived from whichever column is non-null. RLS scopes
 * rows to the caller's org via `org_id_of_event()`, so no org filter here.
 *
 * Site filtering is not free on this table (would need a per-FK-column
 * coalesce join). Phase 19f will tackle it; for now siteId is accepted but
 * ignored on /dashboard, which is always org-wide.
 */

export type ActivitySubjectKind =
  | "incident"
  | "investigation"
  | "capa"
  | "template"
  | "inspection"
  | "finding"
  | "asset"
  | "document"
  | "document_link"
  | "jsa"
  | "other";

export type RecentActivityRow = {
  id: string;
  verb: string;
  actor_kind: string;
  actor_name: string | null;
  subject_kind: ActivitySubjectKind;
  subject_id: string | null;
  created_at: string;
};

type Raw = {
  id: string;
  verb: string;
  actor_kind: string | null;
  created_at: string;
  incident_id: string | null;
  investigation_id: string | null;
  capa_id: string | null;
  template_id: string | null;
  inspection_id: string | null;
  finding_id: string | null;
  asset_id: string | null;
  document_id: string | null;
  document_link_id: string | null;
  jsa_id: string | null;
  actor: { full_name: string | null } | null;
};

function deriveSubject(row: Raw): { kind: ActivitySubjectKind; id: string | null } {
  if (row.incident_id) return { kind: "incident", id: row.incident_id };
  if (row.investigation_id) return { kind: "investigation", id: row.investigation_id };
  if (row.capa_id) return { kind: "capa", id: row.capa_id };
  if (row.inspection_id) return { kind: "inspection", id: row.inspection_id };
  if (row.finding_id) return { kind: "finding", id: row.finding_id };
  if (row.template_id) return { kind: "template", id: row.template_id };
  if (row.asset_id) return { kind: "asset", id: row.asset_id };
  if (row.document_id) return { kind: "document", id: row.document_id };
  if (row.document_link_id) return { kind: "document_link", id: row.document_link_id };
  if (row.jsa_id) return { kind: "jsa", id: row.jsa_id };
  return { kind: "other", id: null };
}

export async function getRecentActivity(
  supabase: SupabaseClient<Database>,
  _orgId: string | null,
  _siteId: string | null,
  limit = 10,
): Promise<RecentActivityRow[]> {
  const { data } = await supabase
    .from("activity_events")
    .select(
      "id, verb, actor_kind, created_at, incident_id, investigation_id, capa_id, template_id, inspection_id, finding_id, asset_id, document_id, document_link_id, jsa_id, actor:profiles!actor_id(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as Raw[]).map((r) => {
    const subject = deriveSubject(r);
    return {
      id: r.id,
      verb: r.verb,
      actor_kind: r.actor_kind ?? "human",
      actor_name: r.actor?.full_name ?? null,
      subject_kind: subject.kind,
      subject_id: subject.id,
      created_at: r.created_at,
    };
  });
}
