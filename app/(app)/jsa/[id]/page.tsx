import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ShieldCheck, FileText, ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { JsaDetailView, type JsaDetailData } from "@/components/jsa/jsa-detail-view";
import type { JsaStatus, JsaIncidentLinkType } from "@/lib/actions/jsa-schemas";
import type { RiskLevel, HazardCategory, ControlLevel } from "@/lib/risk/types";

type Params = Promise<{ id: string }>;

export default async function JsaDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  type JsaSelect = {
    id: string;
    ref_code: string | null;
    title: string;
    job_description: string | null;
    area: string | null;
    site_id: string;
    site: { name: string } | null;
    performed_by_roles: string[];
    performed_by_workgroups: string[];
    frequency: string | null;
    estimated_duration_minutes: number | null;
    ppe_required: string[];
    permits_required: string[];
    status: JsaStatus;
    expires_at: string | null;
    approved_at: string | null;
    approved_by: string | null;
    approved_by_profile: { full_name: string | null } | null;
    created_at: string;
    created_by: string;
    created_by_profile: { full_name: string | null } | null;
    steps: Array<{
      id: string;
      sequence: number;
      step_description: string;
      hazards: Array<{
        id: string;
        hazard_description: string;
        hazard_category: HazardCategory;
        inherent_risk_score: RiskLevel;
        residual_risk_score: RiskLevel;
        promoted_to_register: boolean;
        hazard_candidate_id: string | null;
        registered_hazard_id: string | null;
        controls: Array<{ control_level: ControlLevel; control_description: string }>;
      }>;
    }>;
    signoffs: Array<{
      id: string;
      signed_at: string;
      signed_for_session: string | null;
      worker: { full_name: string | null } | null;
    }>;
    incident_links: Array<{
      id: string;
      link_type: JsaIncidentLinkType;
      identified_at: string;
      incident: {
        id: string;
        ref_code: string | null;
        title: string;
        severity: RiskLevel | null;
      } | null;
    }>;
  };
  const { data: row, error } = await supabase
    .from("jsas")
    .select(
      "id, ref_code, title, job_description, area, site_id, " +
        "site:site_id(name), " +
        "performed_by_roles, performed_by_workgroups, frequency, estimated_duration_minutes, " +
        "ppe_required, permits_required, status, expires_at, approved_at, approved_by, " +
        "approved_by_profile:profiles!jsas_approved_by_fkey(full_name), " +
        "created_at, created_by, " +
        "created_by_profile:profiles!jsas_created_by_fkey(full_name), " +
        "steps:jsa_steps(id, sequence, step_description, " +
        "  hazards:jsa_step_hazards(id, hazard_description, hazard_category, " +
        "    inherent_risk_score, residual_risk_score, promoted_to_register, " +
        "    hazard_candidate_id, registered_hazard_id, " +
        "    controls:jsa_step_controls(control_level, control_description)" +
        "  )" +
        "), " +
        "signoffs:jsa_signoffs(id, signed_at, signed_for_session, worker:profiles!jsa_signoffs_worker_id_fkey(full_name)), " +
        "incident_links:jsa_incident_links(id, link_type, identified_at, " +
        "  incident:incidents(id, ref_code, title, severity)" +
        ")",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .order("sequence", { foreignTable: "steps", ascending: true })
    .order("signed_at", { foreignTable: "signoffs", ascending: false })
    .returns<JsaSelect[]>()
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error.message}
      </div>
    );
  }
  if (!row) notFound();

  const canDraft = await can("jsa:draft", row.site_id);
  const canApprove = await can("jsa:approve", row.site_id);
  const canSignoff = await can("jsa:signoff", row.site_id);
  const canPromote = await can("jsa:promote_step_hazard", row.site_id);
  const isAuthor = user.id === row.created_by;
  const canEdit = row.status === "draft" && canDraft;
  const canUnpublish =
    (row.status === "approved" && (canApprove || (isAuthor && canDraft))) ||
    (row.status === "under_review" && (canApprove || (isAuthor && canDraft)));

  const detailData: JsaDetailData = {
    id: row.id,
    ref_code: row.ref_code,
    title: row.title,
    job_description: row.job_description,
    area: row.area,
    site_name: row.site?.name ?? null,
    performed_by_roles: row.performed_by_roles ?? [],
    performed_by_workgroups: row.performed_by_workgroups ?? [],
    frequency: row.frequency,
    estimated_duration_minutes: row.estimated_duration_minutes,
    ppe_required: row.ppe_required ?? [],
    permits_required: row.permits_required ?? [],
    status: row.status,
    expires_at: row.expires_at,
    approved_at: row.approved_at,
    approved_by_name: row.approved_by_profile?.full_name ?? null,
    created_by_name: row.created_by_profile?.full_name ?? null,
    created_at: row.created_at,
    steps: (row.steps ?? [])
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((s) => ({
        id: s.id,
        sequence: s.sequence,
        step_description: s.step_description,
        hazards: s.hazards ?? [],
      })),
    signoffs: (row.signoffs ?? []).map((so) => ({
      id: so.id,
      worker_name: so.worker?.full_name ?? null,
      signed_at: so.signed_at,
      signed_for_session: so.signed_for_session,
    })),
    linked_incidents: (row.incident_links ?? []).map((l) => ({
      id: l.incident?.id ?? "",
      link_type: l.link_type,
      incident_ref: l.incident?.ref_code ?? null,
      incident_title: l.incident?.title ?? "(incident)",
      severity: l.incident?.severity ?? null,
      identified_at: l.identified_at,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/jsa" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" /> All JSAs
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canSignoff && row.status === "approved" && (
            <Link
              href={`/jsa/${row.id}/perform`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:border-foreground/20"
            >
              <ShieldCheck className="h-4 w-4" /> Sign off
            </Link>
          )}
          {canEdit && (
            <Link
              href={`/jsa/${row.id}/edit?step=steps`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:border-foreground/20"
            >
              <Pencil className="h-4 w-4" /> Edit draft
            </Link>
          )}
          {row.status === "under_review" && (
            <Link
              href={`/jsa/${row.id}/edit?step=approve`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <FileText className="h-4 w-4" /> Review & approve
            </Link>
          )}
        </div>
      </div>

      {canUnpublish && row.status !== "draft" && (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
          <span className="text-muted-foreground">
            To re-edit this JSA, open it in edit mode — it will be returned to draft.
          </span>
        </div>
      )}

      <JsaDetailView data={detailData} canPromote={canPromote && row.status !== "archived"} />
    </div>
  );
}
