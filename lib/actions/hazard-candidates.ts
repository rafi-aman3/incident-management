"use server";

/**
 * Hazard candidate review queue actions (Phase 14).
 *
 * Candidates funnel from 8 inbound source_types (worker report, inspection,
 * incident review, SDS import, MOC, audit finding, external advisory, JSA)
 * into one review queue. EHS managers convert/dismiss/merge.
 *
 * convertCandidate is the load-bearing one: it materializes a hazard + an
 * initial RA + N initial controls. Done as sequenced inserts in v1 — if
 * anything fails mid-sequence the candidate.conversion_hazard_id flip
 * doesn't happen and the operator retries. Migrate to a Postgres function
 * if drift becomes a problem.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";
import { computeRisk, computeResidual } from "@/lib/risk/matrix";
import type { ControlLevel, RiskLevel } from "@/lib/risk/types";
import {
  CreateCandidateSchema,
  ConvertCandidateSchema,
  DismissCandidateSchema,
  MergeCandidateSchema,
} from "./hazard-candidates-schemas";

// hazard_source value derived from candidate.source_type
const SOURCE_TO_HAZARD_SOURCE: Record<string, string> = {
  worker_report: "worker_report",
  inspection: "inspection",
  incident_review: "past_incident",
  management_of_change: "change",
  audit_finding: "external_input",
  external_advisory: "external_input",
  sds_import: "sds_import",
  jsa: "jsa",
};

// ---------------------------------------------------------------------------
// createCandidate
// ---------------------------------------------------------------------------
export async function createCandidate(
  input: z.input<typeof CreateCandidateSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateCandidateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid candidate",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, profile, user } = await requireUser();

  // Site-scoped candidates require hazard:report on the site. Null-site
  // candidates (rare; some SDS / advisory paths) skip the per-site gate
  // and rely on RLS to allow only authenticated org members to insert.
  if (parsed.data.site_id) {
    if (!(await can("hazard:report", parsed.data.site_id))) {
      return { ok: false, error: "Forbidden: missing hazard:report" };
    }
  }

  const { data, error } = await supabase
    .from("hazard_candidates")
    .insert({
      org_id: profile.org_id,
      source_type: parsed.data.source_type,
      source_reference_id: parsed.data.source_reference_id ?? null,
      site_id: parsed.data.site_id ?? null,
      area: parsed.data.area ?? null,
      proposed_title: parsed.data.proposed_title,
      proposed_category: parsed.data.proposed_category,
      proposed_description: parsed.data.proposed_description ?? null,
      proposed_metadata: (parsed.data.proposed_metadata ?? {}) as never,
      proposed_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "hazard_candidate.created",
    payload: {
      candidate_id: data.id,
      source_type: parsed.data.source_type,
      site_id: parsed.data.site_id ?? null,
    },
  });

  revalidatePath("/hazards/candidates");
  return { ok: true, data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// convertCandidate — creates hazard + initial RA + initial controls
// ---------------------------------------------------------------------------
export async function convertCandidate(
  candidateId: string,
  input: z.input<typeof ConvertCandidateSchema>,
): Promise<ActionResult<{ hazard_id: string; ref_code: string | null }>> {
  const parsed = ConvertCandidateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid conversion",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, profile, user } = await requireUser();

  const { data: candidate, error: readErr } = await supabase
    .from("hazard_candidates")
    .select("id, source_type, site_id, status, source_reference_id, proposed_metadata")
    .eq("id", candidateId)
    .single();
  if (readErr || !candidate) {
    return { ok: false, error: readErr?.message ?? "Candidate not found" };
  }
  if (candidate.status !== "pending_review") {
    return { ok: false, error: `Candidate already ${candidate.status}` };
  }

  const targetSiteId = parsed.data.hazard.site_id;
  if (!(await can("hazard_candidate:review", targetSiteId))) {
    return { ok: false, error: "Forbidden: missing hazard_candidate:review" };
  }

  // 1. Insert hazard row
  const hazardSource = SOURCE_TO_HAZARD_SOURCE[candidate.source_type] ?? "external_input";
  const { data: hazard, error: hazardErr } = await supabase
    .from("hazards")
    .insert({
      org_id: profile.org_id,
      site_id: targetSiteId,
      area: parsed.data.hazard.area ?? null,
      title: parsed.data.hazard.title,
      description: parsed.data.hazard.description ?? null,
      hazard_category: parsed.data.hazard.hazard_category,
      hazard_source: hazardSource,
      affects_workers: parsed.data.hazard.affects_workers ?? [],
      affects_others: parsed.data.hazard.affects_others ?? [],
      identified_by: user.id,
      identification_method: parsed.data.hazard.identification_method ?? null,
      source_candidate_id: candidateId,
      source_incident_id: parsed.data.hazard.source_incident_id ?? null,
      source_sds_id:
        parsed.data.hazard.source_sds_id ??
        (candidate.source_type === "sds_import" ? candidate.source_reference_id : null),
      source_sds_section: parsed.data.hazard.source_sds_section ?? null,
    })
    .select("id, ref_code")
    .single();
  if (hazardErr || !hazard) {
    return { ok: false, error: hazardErr?.message ?? "Hazard insert failed" };
  }

  // 2. Insert initial controls (so the RA's residual can account for them)
  const controlLevels: ControlLevel[] = [];
  if (parsed.data.initial_controls.length > 0) {
    const controlRows = parsed.data.initial_controls.map((c) => ({
      hazard_id: hazard.id,
      control_level: c.control_level,
      control_description: c.control_description,
      effectiveness: c.effectiveness ?? "not_yet_verified",
      responsible_party_id: c.responsible_party_id ?? null,
      implemented_at: c.implemented_at ?? null,
      next_verification_at: c.next_verification_at ?? null,
      next_control_review_at: c.next_control_review_at ?? null,
      origin: "from_initial_assessment" as const,
    }));
    const { error: ctrlErr } = await supabase.from("hazard_controls").insert(controlRows);
    if (ctrlErr) {
      return { ok: false, error: `Hazard created but controls failed: ${ctrlErr.message}` };
    }
    for (const r of controlRows) controlLevels.push(r.control_level as ControlLevel);
  }

  // 3. Insert initial risk assessment
  const inherent = computeRisk(
    parsed.data.initial_assessment.likelihood,
    parsed.data.initial_assessment.consequence,
  );
  const residual = computeResidual(inherent, controlLevels);

  const { data: ra, error: raErr } = await supabase
    .from("hazard_risk_assessments")
    .insert({
      hazard_id: hazard.id,
      likelihood: parsed.data.initial_assessment.likelihood,
      consequence: parsed.data.initial_assessment.consequence,
      inherent_risk_score: inherent,
      residual_risk_score: residual,
      trigger_type: "initial",
      rationale: parsed.data.initial_assessment.rationale ?? null,
      assessor_id: user.id,
      consulted_worker_ids: parsed.data.initial_assessment.consulted_worker_ids ?? [],
      next_review_at: parsed.data.initial_assessment.next_review_at ?? null,
    })
    .select("id")
    .single();
  if (raErr || !ra) {
    return { ok: false, error: `Hazard created but RA failed: ${raErr?.message ?? "?"}` };
  }

  // 4. Patch hazard with current RA + initial status
  const initialStatus = controlLevels.length > 0 ? "controlled" : "under_assessment";
  await supabase
    .from("hazards")
    .update({ current_risk_assessment_id: ra.id, status: initialStatus })
    .eq("id", hazard.id);

  // 5. Mark candidate converted
  await supabase
    .from("hazard_candidates")
    .update({
      status: "converted",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      conversion_hazard_id: hazard.id,
    })
    .eq("id", candidateId);

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "hazard_candidate.converted",
    payload: {
      candidate_id: candidateId,
      hazard_id: hazard.id,
      ref_code: hazard.ref_code,
      controls_count: controlLevels.length,
      inherent,
      residual: residual as RiskLevel,
    },
  });

  revalidatePath("/hazards");
  revalidatePath("/hazards/candidates");
  revalidatePath(`/hazards/${hazard.id}`);
  return { ok: true, data: { hazard_id: hazard.id, ref_code: hazard.ref_code } };
}

// ---------------------------------------------------------------------------
// dismissCandidate
// ---------------------------------------------------------------------------
export async function dismissCandidate(
  candidateId: string,
  input: z.input<typeof DismissCandidateSchema>,
): Promise<ActionResult<void>> {
  const parsed = DismissCandidateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid dismiss",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  const { data: candidate, error: readErr } = await supabase
    .from("hazard_candidates")
    .select("id, site_id, status")
    .eq("id", candidateId)
    .single();
  if (readErr || !candidate) {
    return { ok: false, error: readErr?.message ?? "Candidate not found" };
  }
  if (candidate.status !== "pending_review") {
    return { ok: false, error: `Candidate already ${candidate.status}` };
  }

  if (!(await can("hazard_candidate:review", candidate.site_id))) {
    return { ok: false, error: "Forbidden: missing hazard_candidate:review" };
  }

  const { error } = await supabase
    .from("hazard_candidates")
    .update({
      status: "dismissed",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      dismiss_reason: parsed.data.reason,
    })
    .eq("id", candidateId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "hazard_candidate.dismissed",
    payload: { candidate_id: candidateId, reason: parsed.data.reason },
  });

  revalidatePath("/hazards/candidates");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// mergeCandidate — folds a candidate into an existing hazard
// ---------------------------------------------------------------------------
export async function mergeCandidate(
  candidateId: string,
  input: z.input<typeof MergeCandidateSchema>,
): Promise<ActionResult<void>> {
  const parsed = MergeCandidateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid merge",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  const { data: candidate, error: readErr } = await supabase
    .from("hazard_candidates")
    .select("id, site_id, status")
    .eq("id", candidateId)
    .single();
  if (readErr || !candidate) {
    return { ok: false, error: readErr?.message ?? "Candidate not found" };
  }
  if (candidate.status !== "pending_review") {
    return { ok: false, error: `Candidate already ${candidate.status}` };
  }

  if (!(await can("hazard_candidate:review", candidate.site_id))) {
    return { ok: false, error: "Forbidden: missing hazard_candidate:review" };
  }

  // Confirm the target hazard is in the same org + accessible to caller.
  const { data: target, error: targetErr } = await supabase
    .from("hazards")
    .select("id, site_id")
    .eq("id", parsed.data.into_hazard_id)
    .is("deleted_at", null)
    .single();
  if (targetErr || !target) {
    return { ok: false, error: targetErr?.message ?? "Target hazard not found" };
  }

  const { error } = await supabase
    .from("hazard_candidates")
    .update({
      status: "merged",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      merged_into_hazard_id: target.id,
      dismiss_reason: parsed.data.note ?? null,
    })
    .eq("id", candidateId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "hazard_candidate.merged",
    payload: {
      candidate_id: candidateId,
      hazard_id: target.id,
      note: parsed.data.note ?? null,
    },
  });

  revalidatePath("/hazards/candidates");
  revalidatePath(`/hazards/${target.id}`);
  return { ok: true };
}
