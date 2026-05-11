"use server";

/**
 * Server actions for the Phase 14 Hazard Register.
 *
 * RBAC gates use `can()` from lib/auth/can.ts; RLS double-checks every
 * write. Residual risk computation goes through `lib/risk/matrix.ts` so the
 * incident severity engine and these actions share one lookup.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";
import { computeRisk, computeResidual } from "@/lib/risk/matrix";
import type { ControlLevel, RiskLevel } from "@/lib/risk/types";
import type { Database } from "@/lib/supabase/types";
import {
  CreateHazardSchema,
  UpdateHazardSchema,
  CreateRiskAssessmentSchema,
  AddControlSchema,
  UpdateControlSchema,
  VerifyControlSchema,
  CloseHazardSchema,
} from "./hazards-schemas";

type HazardUpdate = Database["public"]["Tables"]["hazards"]["Update"];
type HazardControlUpdate = Database["public"]["Tables"]["hazard_controls"]["Update"];

// ---------------------------------------------------------------------------
// createHazard
// ---------------------------------------------------------------------------
export async function createHazard(
  input: z.input<typeof CreateHazardSchema>,
): Promise<ActionResult<{ id: string; ref_code: string | null }>> {
  const parsed = CreateHazardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid hazard",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, profile, user } = await requireUser();

  if (!(await can("hazard:report", parsed.data.site_id))) {
    return { ok: false, error: "Forbidden: missing hazard:report" };
  }

  const { data, error } = await supabase
    .from("hazards")
    .insert({
      org_id: profile.org_id,
      site_id: parsed.data.site_id,
      area: parsed.data.area ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      hazard_category: parsed.data.hazard_category,
      hazard_source: parsed.data.hazard_source,
      affects_workers: parsed.data.affects_workers,
      affects_others: parsed.data.affects_others,
      identified_by: user.id,
      identification_method: parsed.data.identification_method ?? null,
      source_candidate_id: parsed.data.source_candidate_id ?? null,
      source_incident_id: parsed.data.source_incident_id ?? null,
      source_sds_id: parsed.data.source_sds_id ?? null,
      source_sds_section: parsed.data.source_sds_section ?? null,
    })
    .select("id, ref_code")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed" };
  }

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "hazard.created",
    payload: {
      hazard_id: data.id,
      ref_code: data.ref_code,
      site_id: parsed.data.site_id,
      title: parsed.data.title,
      category: parsed.data.hazard_category,
    },
  });

  revalidatePath("/hazards");
  revalidatePath(`/hazards/${data.id}`);
  return { ok: true, data: { id: data.id, ref_code: data.ref_code } };
}

// ---------------------------------------------------------------------------
// updateHazard
// ---------------------------------------------------------------------------
export async function updateHazard(
  hazardId: string,
  input: z.input<typeof UpdateHazardSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdateHazardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid update",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  const { data: existing, error: readErr } = await supabase
    .from("hazards")
    .select("site_id")
    .eq("id", hazardId)
    .is("deleted_at", null)
    .single();
  if (readErr || !existing) {
    return { ok: false, error: readErr?.message ?? "Hazard not found" };
  }
  if (!(await can("hazard:manage", existing.site_id))) {
    return { ok: false, error: "Forbidden: missing hazard:manage" };
  }

  const patch: HazardUpdate = {};
  if (parsed.data.area !== undefined) patch.area = parsed.data.area;
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.hazard_category !== undefined) patch.hazard_category = parsed.data.hazard_category;
  if (parsed.data.affects_workers !== undefined) patch.affects_workers = parsed.data.affects_workers;
  if (parsed.data.affects_others !== undefined) patch.affects_others = parsed.data.affects_others;

  if (Object.keys(patch).length === 0) {
    return { ok: true };
  }

  const { error } = await supabase.from("hazards").update(patch).eq("id", hazardId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "hazard.updated",
    payload: { hazard_id: hazardId, fields: Object.keys(patch) },
  });

  revalidatePath(`/hazards/${hazardId}`);
  revalidatePath("/hazards");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// createRiskAssessment — appends a new RA + flips hazards.current_risk_assessment_id
// ---------------------------------------------------------------------------
export async function createRiskAssessment(
  hazardId: string,
  input: z.input<typeof CreateRiskAssessmentSchema>,
): Promise<ActionResult<{ id: string; inherent: RiskLevel; residual: RiskLevel }>> {
  const parsed = CreateRiskAssessmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid assessment",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  const { data: hazard, error: readErr } = await supabase
    .from("hazards")
    .select("id, site_id, current_risk_assessment_id, status")
    .eq("id", hazardId)
    .is("deleted_at", null)
    .single();
  if (readErr || !hazard) {
    return { ok: false, error: readErr?.message ?? "Hazard not found" };
  }
  if (!(await can("hazard:manage", hazard.site_id))) {
    return { ok: false, error: "Forbidden: missing hazard:manage" };
  }

  const inherent = computeRisk(parsed.data.likelihood, parsed.data.consequence);

  // Residual: prefer caller-supplied control_levels (used by convertCandidate);
  // otherwise pull the hazard's current active controls and derive from them.
  let controlLevels: ControlLevel[] = parsed.data.control_levels ?? [];
  if (parsed.data.control_levels === undefined) {
    const { data: controls } = await supabase
      .from("hazard_controls")
      .select("control_level")
      .eq("hazard_id", hazardId)
      .is("deleted_at", null);
    controlLevels = (controls ?? []).map((c) => c.control_level as ControlLevel);
  }
  const residual = computeResidual(inherent, controlLevels);

  const { data: ra, error: insertErr } = await supabase
    .from("hazard_risk_assessments")
    .insert({
      hazard_id: hazardId,
      likelihood: parsed.data.likelihood,
      consequence: parsed.data.consequence,
      inherent_risk_score: inherent,
      residual_risk_score: residual,
      trigger_type: parsed.data.trigger_type,
      triggered_by_incident_id: parsed.data.triggered_by_incident_id ?? null,
      rationale: parsed.data.rationale ?? null,
      assessor_id: user.id,
      consulted_worker_ids: parsed.data.consulted_worker_ids,
      next_review_at: parsed.data.next_review_at ?? null,
    })
    .select("id")
    .single();
  if (insertErr || !ra) {
    return { ok: false, error: insertErr?.message ?? "Insert failed" };
  }

  // Supersede the previous one if present
  if (hazard.current_risk_assessment_id) {
    await supabase
      .from("hazard_risk_assessments")
      .update({ superseded_at: new Date().toISOString() })
      .eq("id", hazard.current_risk_assessment_id);
  }

  // Status: identified → under_assessment on first RA; if status was 'controlled' or
  // 'monitoring' and the trigger is post-incident, the linkIncidentToHazard action
  // already flipped to under_assessment.
  let nextStatus: string | null = null;
  if (hazard.status === "identified") nextStatus = "under_assessment";

  const hazardPatch: HazardUpdate = { current_risk_assessment_id: ra.id };
  if (nextStatus) hazardPatch.status = nextStatus;
  await supabase.from("hazards").update(hazardPatch).eq("id", hazardId);

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "hazard.assessment_added",
    payload: {
      hazard_id: hazardId,
      assessment_id: ra.id,
      inherent,
      residual,
      trigger: parsed.data.trigger_type,
    },
  });

  revalidatePath(`/hazards/${hazardId}`);
  revalidatePath("/hazards");
  return { ok: true, data: { id: ra.id, inherent, residual } };
}

// ---------------------------------------------------------------------------
// addControl — appends a control row; recomputes residual on the current RA
// ---------------------------------------------------------------------------
export async function addControl(
  hazardId: string,
  input: z.input<typeof AddControlSchema>,
): Promise<ActionResult<{ id: string; residual: RiskLevel | null }>> {
  const parsed = AddControlSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid control",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  const { data: hazard, error: readErr } = await supabase
    .from("hazards")
    .select("id, site_id, current_risk_assessment_id, status")
    .eq("id", hazardId)
    .is("deleted_at", null)
    .single();
  if (readErr || !hazard) {
    return { ok: false, error: readErr?.message ?? "Hazard not found" };
  }
  if (!(await can("hazard:manage", hazard.site_id))) {
    return { ok: false, error: "Forbidden: missing hazard:manage" };
  }

  const { data: control, error: insertErr } = await supabase
    .from("hazard_controls")
    .insert({
      hazard_id: hazardId,
      control_level: parsed.data.control_level,
      control_description: parsed.data.control_description,
      effectiveness: parsed.data.effectiveness,
      responsible_party_id: parsed.data.responsible_party_id ?? null,
      implemented_at: parsed.data.implemented_at ?? null,
      next_verification_at: parsed.data.next_verification_at ?? null,
      next_control_review_at: parsed.data.next_control_review_at ?? null,
      origin: parsed.data.origin,
      origin_capa_id: parsed.data.origin_capa_id ?? null,
    })
    .select("id")
    .single();
  if (insertErr || !control) {
    return { ok: false, error: insertErr?.message ?? "Insert failed" };
  }

  // Recompute residual against the current RA if one exists
  let residual: RiskLevel | null = null;
  if (hazard.current_risk_assessment_id) {
    const { data: ra } = await supabase
      .from("hazard_risk_assessments")
      .select("inherent_risk_score, residual_risk_score")
      .eq("id", hazard.current_risk_assessment_id)
      .single();
    if (ra) {
      const { data: controls } = await supabase
        .from("hazard_controls")
        .select("control_level")
        .eq("hazard_id", hazardId)
        .is("deleted_at", null);
      const levels = (controls ?? []).map((c) => c.control_level as ControlLevel);
      residual = computeResidual(ra.inherent_risk_score as RiskLevel, levels);
      if (residual !== ra.residual_risk_score) {
        await supabase
          .from("hazard_risk_assessments")
          .update({ residual_risk_score: residual })
          .eq("id", hazard.current_risk_assessment_id);
      }
    }
  }

  // Flip status to 'controlled' if hazard had been in under_assessment and now
  // has at least one engineering-or-higher control.
  if (hazard.status === "under_assessment") {
    await supabase.from("hazards").update({ status: "controlled" }).eq("id", hazardId);
  }

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "hazard.control_added",
    payload: {
      hazard_id: hazardId,
      control_id: control.id,
      level: parsed.data.control_level,
    },
  });

  revalidatePath(`/hazards/${hazardId}`);
  return { ok: true, data: { id: control.id, residual } };
}

// ---------------------------------------------------------------------------
// updateControl
// ---------------------------------------------------------------------------
export async function updateControl(
  controlId: string,
  input: z.input<typeof UpdateControlSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdateControlSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid update",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  const { data: control, error: readErr } = await supabase
    .from("hazard_controls")
    .select("hazard_id, hazards:hazard_id(site_id)")
    .eq("id", controlId)
    .is("deleted_at", null)
    .single<{ hazard_id: string; hazards: { site_id: string } | null }>();
  if (readErr || !control?.hazards) {
    return { ok: false, error: readErr?.message ?? "Control not found" };
  }
  if (!(await can("hazard:manage", control.hazards.site_id))) {
    return { ok: false, error: "Forbidden: missing hazard:manage" };
  }

  const patch: HazardControlUpdate = {};
  for (const key of [
    "control_level",
    "control_description",
    "effectiveness",
    "responsible_party_id",
    "implemented_at",
    "next_verification_at",
    "next_control_review_at",
    "origin_capa_id",
  ] as const) {
    const v = parsed.data[key];
    if (v !== undefined) (patch as Record<string, unknown>)[key] = v;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from("hazard_controls").update(patch).eq("id", controlId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "hazard.control_updated",
    payload: { control_id: controlId, hazard_id: control.hazard_id, fields: Object.keys(patch) },
  });

  revalidatePath(`/hazards/${control.hazard_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// verifyControl
// ---------------------------------------------------------------------------
export async function verifyControl(
  controlId: string,
  input: z.input<typeof VerifyControlSchema>,
): Promise<ActionResult<void>> {
  const parsed = VerifyControlSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid verification",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  const { data: control, error: readErr } = await supabase
    .from("hazard_controls")
    .select("hazard_id, hazards:hazard_id(site_id)")
    .eq("id", controlId)
    .is("deleted_at", null)
    .single<{ hazard_id: string; hazards: { site_id: string } | null }>();
  if (readErr || !control?.hazards) {
    return { ok: false, error: readErr?.message ?? "Control not found" };
  }
  if (!(await can("hazard:manage", control.hazards.site_id))) {
    return { ok: false, error: "Forbidden: missing hazard:manage" };
  }

  const { error } = await supabase
    .from("hazard_controls")
    .update({
      effectiveness: parsed.data.effectiveness,
      last_verified_at: new Date().toISOString(),
      next_verification_at: parsed.data.next_verification_at ?? null,
      next_control_review_at: parsed.data.next_control_review_at ?? null,
    })
    .eq("id", controlId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "hazard.control_verified",
    payload: {
      control_id: controlId,
      hazard_id: control.hazard_id,
      effectiveness: parsed.data.effectiveness,
      notes: parsed.data.notes ?? null,
    },
  });

  revalidatePath(`/hazards/${control.hazard_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// closeHazard
// ---------------------------------------------------------------------------
export async function closeHazard(
  hazardId: string,
  input: z.input<typeof CloseHazardSchema>,
): Promise<ActionResult<void>> {
  const parsed = CloseHazardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid close",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  const { data: hazard, error: readErr } = await supabase
    .from("hazards")
    .select("id, site_id, status")
    .eq("id", hazardId)
    .is("deleted_at", null)
    .single();
  if (readErr || !hazard) {
    return { ok: false, error: readErr?.message ?? "Hazard not found" };
  }
  if (!(await can("hazard:close", hazard.site_id))) {
    return { ok: false, error: "Forbidden: missing hazard:close" };
  }

  const targetStatus = parsed.data.superseded_by_hazard_id ? "superseded" : "closed";

  const { error } = await supabase
    .from("hazards")
    .update({
      status: targetStatus,
      closed_at: new Date().toISOString(),
      closed_reason: parsed.data.reason,
      superseded_by_hazard_id: parsed.data.superseded_by_hazard_id ?? null,
    })
    .eq("id", hazardId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: targetStatus === "superseded" ? "hazard.superseded" : "hazard.closed",
    payload: {
      hazard_id: hazardId,
      reason: parsed.data.reason,
      superseded_by: parsed.data.superseded_by_hazard_id ?? null,
    },
  });

  revalidatePath(`/hazards/${hazardId}`);
  revalidatePath("/hazards");
  return { ok: true };
}
