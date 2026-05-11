"use server";

/**
 * Server actions for the Phase 15 JSA module.
 *
 * Workflow:
 *   createJsaDraft   →  inserts jsas row with status='draft' (Step 1 wizard)
 *   updateJsa        →  full transactional replace of body + steps + hazards +
 *                       controls (drafts only)
 *   submitForReview  →  draft → under_review (creator action)
 *   approveJsa       →  under_review → approved (requires approver != creator,
 *                       three-layer enforcement: DB CHECK + here + UI picker)
 *   unpublishJsa     →  approved → draft (re-edit by author or any approver)
 *   archiveJsa       →  any → archived (soft retire)
 *   signOffJsa       →  worker → jsa_signoffs row (one per shift session)
 *   promoteStepHazard→  one-way per step-hazard; writes a hazard_candidate row
 *                       with source_type='jsa' so EHS reviews via §HZ queue.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";
import { computeRisk, computeResidual } from "@/lib/risk/matrix";
import type { ControlLevel } from "@/lib/risk/types";
import type { Database } from "@/lib/supabase/types";
import {
  CreateJsaDraftSchema,
  UpdateJsaSchema,
  ApproveJsaSchema,
  SignOffJsaSchema,
} from "./jsa-schemas";

type JsaRow = Database["public"]["Tables"]["jsas"]["Row"];

// ---------------------------------------------------------------------------
// createJsaDraft  —  Step-1 wizard finalize. Inserts the jsas row with
// status='draft' so the URL can include the new id for steps 2–4 (mirrors the
// Report Wizard's draft-row pattern).
// ---------------------------------------------------------------------------
export async function createJsaDraft(
  input: z.input<typeof CreateJsaDraftSchema>,
): Promise<ActionResult<{ id: string; ref_code: string | null }>> {
  const parsed = CreateJsaDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid JSA",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, profile, user } = await requireUser();

  if (!(await can("jsa:draft", parsed.data.site_id))) {
    return { ok: false, error: "Forbidden: missing jsa:draft" };
  }

  const { data, error } = await supabase
    .from("jsas")
    .insert({
      org_id: profile.org_id,
      site_id: parsed.data.site_id,
      title: parsed.data.title,
      job_description: parsed.data.job_description ?? null,
      area: parsed.data.area ?? null,
      performed_by_roles: parsed.data.performed_by_roles,
      performed_by_workgroups: parsed.data.performed_by_workgroups,
      frequency: parsed.data.frequency ?? null,
      estimated_duration_minutes: parsed.data.estimated_duration_minutes ?? null,
      ppe_required: parsed.data.ppe_required,
      permits_required: parsed.data.permits_required,
      created_by: user.id,
    })
    .select("id, ref_code")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed" };
  }

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "jsa.draft_created",
    jsa_id: data.id,
    payload: { jsa_id: data.id, ref_code: data.ref_code },
  });

  revalidatePath("/jsa");
  return { ok: true, data: { id: data.id, ref_code: data.ref_code } };
}

// ---------------------------------------------------------------------------
// updateJsa  —  Full replace of body + nested steps + hazards + controls.
// Restricted to status='draft'. The cascade FK on jsa_steps makes "wipe and
// re-insert" cheap (a 10-step × 3-hazard × 3-control JSA = 100 rows).
// ---------------------------------------------------------------------------
export async function updateJsa(
  jsaId: string,
  input: z.input<typeof UpdateJsaSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdateJsaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid update",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  const { data: existing, error: readErr } = await supabase
    .from("jsas")
    .select("id, site_id, status, created_by")
    .eq("id", jsaId)
    .is("deleted_at", null)
    .single();
  if (readErr || !existing) {
    return { ok: false, error: readErr?.message ?? "JSA not found" };
  }
  if (existing.status !== "draft") {
    return {
      ok: false,
      error: "JSA is not editable — unpublish to draft first.",
    };
  }
  if (!(await can("jsa:draft", existing.site_id))) {
    return { ok: false, error: "Forbidden: missing jsa:draft" };
  }

  const { error: updateErr } = await supabase
    .from("jsas")
    .update({
      title: parsed.data.title,
      job_description: parsed.data.job_description ?? null,
      area: parsed.data.area ?? null,
      performed_by_roles: parsed.data.performed_by_roles,
      performed_by_workgroups: parsed.data.performed_by_workgroups,
      frequency: parsed.data.frequency ?? null,
      estimated_duration_minutes: parsed.data.estimated_duration_minutes ?? null,
      ppe_required: parsed.data.ppe_required,
      permits_required: parsed.data.permits_required,
    })
    .eq("id", jsaId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Wipe + re-insert the step tree. The cascade FK on jsa_steps drops the
  // jsa_step_hazards + jsa_step_controls subtrees.
  const { error: delErr } = await supabase
    .from("jsa_steps")
    .delete()
    .eq("jsa_id", jsaId);
  if (delErr) return { ok: false, error: delErr.message };

  for (let i = 0; i < parsed.data.steps.length; i++) {
    const stepInput = parsed.data.steps[i];
    const { data: stepRow, error: stepErr } = await supabase
      .from("jsa_steps")
      .insert({
        jsa_id: jsaId,
        sequence: i + 1,
        step_description: stepInput.step_description,
      })
      .select("id")
      .single();
    if (stepErr || !stepRow) {
      return { ok: false, error: stepErr?.message ?? "Step insert failed" };
    }

    for (const hazardInput of stepInput.hazards) {
      const inherent = computeRisk(hazardInput.likelihood, hazardInput.consequence);
      const controlLevels: ControlLevel[] = hazardInput.controls.map(
        (c) => c.control_level,
      );
      const residual = computeResidual(inherent, controlLevels);

      const { data: hazardRow, error: hzErr } = await supabase
        .from("jsa_step_hazards")
        .insert({
          jsa_step_id: stepRow.id,
          hazard_description: hazardInput.hazard_description,
          hazard_category: hazardInput.hazard_category,
          likelihood: hazardInput.likelihood,
          consequence: hazardInput.consequence,
          inherent_risk_score: inherent,
          residual_risk_score: residual,
        })
        .select("id")
        .single();
      if (hzErr || !hazardRow) {
        return { ok: false, error: hzErr?.message ?? "Hazard insert failed" };
      }

      if (hazardInput.controls.length > 0) {
        const { error: ctlErr } = await supabase
          .from("jsa_step_controls")
          .insert(
            hazardInput.controls.map((c) => ({
              jsa_step_hazard_id: hazardRow.id,
              control_level: c.control_level,
              control_description: c.control_description,
            })),
          );
        if (ctlErr) return { ok: false, error: ctlErr.message };
      }
    }
  }

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "jsa.updated",
    jsa_id: jsaId,
    payload: { jsa_id: jsaId, steps: parsed.data.steps.length },
  });

  revalidatePath(`/jsa/${jsaId}`);
  revalidatePath(`/jsa/${jsaId}/edit`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// submitForReview  —  draft → under_review
// ---------------------------------------------------------------------------
export async function submitForReview(jsaId: string): Promise<ActionResult<void>> {
  return await transitionStatus(jsaId, "draft", "under_review", "jsa:draft", "jsa.submitted");
}

// ---------------------------------------------------------------------------
// approveJsa  —  under_review → approved + sets approved_by + expires_at.
// Three-layer "approver != creator" enforcement, layer 2.
// ---------------------------------------------------------------------------
export async function approveJsa(
  jsaId: string,
  input: z.input<typeof ApproveJsaSchema> = {},
): Promise<ActionResult<void>> {
  const parsed = ApproveJsaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid approval",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  const { data: jsa, error: readErr } = await supabase
    .from("jsas")
    .select("id, site_id, status, created_by")
    .eq("id", jsaId)
    .is("deleted_at", null)
    .single();
  if (readErr || !jsa) return { ok: false, error: readErr?.message ?? "JSA not found" };

  if (jsa.status !== "under_review") {
    return { ok: false, error: `JSA is in ${jsa.status} state; cannot approve.` };
  }
  if (jsa.created_by === user.id) {
    return { ok: false, error: "Approver cannot be the creator of the JSA." };
  }
  if (!(await can("jsa:approve", jsa.site_id))) {
    return { ok: false, error: "Forbidden: missing jsa:approve" };
  }

  // Default expiry = today + 12 months. Overridable via payload.
  const expiresAt =
    parsed.data.expires_at ?? defaultExpiryDate(12);

  const { error: updateErr } = await supabase
    .from("jsas")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .eq("id", jsaId);
  if (updateErr) return { ok: false, error: updateErr.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "jsa.approved",
    jsa_id: jsaId,
    payload: { jsa_id: jsaId, expires_at: expiresAt },
  });

  revalidatePath(`/jsa/${jsaId}`);
  revalidatePath("/jsa");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// unpublishJsa  —  approved → draft (clears approval fields)
// ---------------------------------------------------------------------------
export async function unpublishJsa(jsaId: string): Promise<ActionResult<void>> {
  const { supabase, user } = await requireUser();

  const { data: jsa, error: readErr } = await supabase
    .from("jsas")
    .select("id, site_id, status, created_by")
    .eq("id", jsaId)
    .is("deleted_at", null)
    .single();
  if (readErr || !jsa) return { ok: false, error: readErr?.message ?? "JSA not found" };

  if (jsa.status !== "approved" && jsa.status !== "under_review") {
    return { ok: false, error: `JSA is in ${jsa.status} state; cannot unpublish.` };
  }

  // Authors with jsa:draft OR anyone with jsa:approve on the site.
  const isAuthor = jsa.created_by === user.id;
  const canDraft = await can("jsa:draft", jsa.site_id);
  const canApprove = await can("jsa:approve", jsa.site_id);
  if (!((isAuthor && canDraft) || canApprove)) {
    return { ok: false, error: "Forbidden: must be author with jsa:draft or hold jsa:approve" };
  }

  const { error: updateErr } = await supabase
    .from("jsas")
    .update({
      status: "draft",
      approved_by: null,
      approved_at: null,
      expires_at: null,
    })
    .eq("id", jsaId);
  if (updateErr) return { ok: false, error: updateErr.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "jsa.unpublished",
    jsa_id: jsaId,
    payload: { jsa_id: jsaId },
  });

  revalidatePath(`/jsa/${jsaId}`);
  revalidatePath("/jsa");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// archiveJsa  —  any → archived (soft retire)
// ---------------------------------------------------------------------------
export async function archiveJsa(jsaId: string): Promise<ActionResult<void>> {
  const { supabase, user } = await requireUser();

  const { data: jsa, error: readErr } = await supabase
    .from("jsas")
    .select("id, site_id, status, created_by")
    .eq("id", jsaId)
    .is("deleted_at", null)
    .single();
  if (readErr || !jsa) return { ok: false, error: readErr?.message ?? "JSA not found" };

  const isAuthor = jsa.created_by === user.id;
  const canDraft = await can("jsa:draft", jsa.site_id);
  const canApprove = await can("jsa:approve", jsa.site_id);
  if (!((isAuthor && canDraft) || canApprove)) {
    return { ok: false, error: "Forbidden: must be author or hold jsa:approve" };
  }

  const { error: updateErr } = await supabase
    .from("jsas")
    .update({ status: "archived" })
    .eq("id", jsaId);
  if (updateErr) return { ok: false, error: updateErr.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "jsa.archived",
    jsa_id: jsaId,
    payload: { jsa_id: jsaId },
  });

  revalidatePath(`/jsa/${jsaId}`);
  revalidatePath("/jsa");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// signOffJsa  —  worker → jsa_signoffs row. One row per (jsa, worker, session).
// The unique index coalesces NULL session to '' so workers can also sign
// without picking a session.
// ---------------------------------------------------------------------------
export async function signOffJsa(
  jsaId: string,
  input: z.input<typeof SignOffJsaSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = SignOffJsaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid sign-off",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  const { data: jsa, error: readErr } = await supabase
    .from("jsas")
    .select("id, site_id, status")
    .eq("id", jsaId)
    .is("deleted_at", null)
    .single();
  if (readErr || !jsa) return { ok: false, error: readErr?.message ?? "JSA not found" };

  if (jsa.status !== "approved") {
    return {
      ok: false,
      error: "JSA is not approved — workers can only sign off on approved JSAs.",
    };
  }
  if (!(await can("jsa:signoff", jsa.site_id))) {
    return { ok: false, error: "Forbidden: missing jsa:signoff" };
  }

  const { data, error } = await supabase
    .from("jsa_signoffs")
    .insert({
      jsa_id: jsaId,
      worker_id: user.id,
      signed_for_session: parsed.data.signed_for_session ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return {
        ok: false,
        error: "You've already signed off this JSA for the selected shift session.",
      };
    }
    return { ok: false, error: error?.message ?? "Sign-off failed" };
  }

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "jsa.signed_off",
    jsa_id: jsaId,
    payload: {
      jsa_id: jsaId,
      session: parsed.data.signed_for_session ?? null,
    },
  });

  revalidatePath(`/jsa/${jsaId}`);
  revalidatePath(`/jsa/${jsaId}/perform`);
  return { ok: true, data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// promoteStepHazard  —  one-way per step-hazard. Creates a row in
// hazard_candidates (source_type='jsa') so the EHS team reviews via §HZ.
// Hides the button on the step-hazard regardless of how the candidate later
// resolves.
// ---------------------------------------------------------------------------
export async function promoteStepHazard(
  stepHazardId: string,
): Promise<ActionResult<{ candidate_id: string }>> {
  const { supabase, profile, user } = await requireUser();

  const { data: row, error: readErr } = await supabase
    .from("jsa_step_hazards")
    .select(
      `id, hazard_description, hazard_category, promoted_to_register,
       step:jsa_steps!inner (
         id, jsa_id,
         jsa:jsas!inner ( id, site_id, ref_code, area, title )
       )`,
    )
    .eq("id", stepHazardId)
    .single();
  if (readErr || !row) return { ok: false, error: readErr?.message ?? "Step hazard not found" };

  // Supabase typed result returns nested singletons as arrays unless we use
  // !inner — but defence-in-depth: tolerate both shapes.
  const step = Array.isArray(row.step) ? row.step[0] : row.step;
  const jsa = step && (Array.isArray(step.jsa) ? step.jsa[0] : step.jsa);
  if (!jsa) return { ok: false, error: "Parent JSA not found" };

  if (row.promoted_to_register) {
    return { ok: false, error: "Already promoted to the hazard register." };
  }
  if (!(await can("jsa:promote_step_hazard", jsa.site_id))) {
    return { ok: false, error: "Forbidden: missing jsa:promote_step_hazard" };
  }

  // Stash the JSA pointer in proposed_metadata so the §HZ convertCandidate
  // form can backlink ("Promoted from JSA-…").
  const proposedMetadata = {
    source: "jsa" as const,
    jsa_id: jsa.id,
    jsa_ref_code: jsa.ref_code,
    jsa_title: jsa.title,
    step_hazard_id: row.id,
  };

  const { data: candidate, error: candErr } = await supabase
    .from("hazard_candidates")
    .insert({
      org_id: profile.org_id,
      site_id: jsa.site_id,
      area: jsa.area ?? null,
      source_type: "jsa",
      source_reference_id: row.id,
      proposed_title: row.hazard_description.slice(0, 160),
      proposed_category: row.hazard_category,
      proposed_description: row.hazard_description,
      proposed_metadata: proposedMetadata,
      proposed_by: user.id,
    })
    .select("id")
    .single();
  if (candErr || !candidate) {
    return { ok: false, error: candErr?.message ?? "Candidate insert failed" };
  }

  const { error: updateErr } = await supabase
    .from("jsa_step_hazards")
    .update({
      promoted_to_register: true,
      hazard_candidate_id: candidate.id,
    })
    .eq("id", stepHazardId);
  if (updateErr) return { ok: false, error: updateErr.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "jsa.step_hazard_promoted",
    jsa_id: jsa.id,
    payload: {
      jsa_id: jsa.id,
      step_hazard_id: row.id,
      candidate_id: candidate.id,
    },
  });

  revalidatePath(`/jsa/${jsa.id}`);
  revalidatePath("/hazards/candidates");
  return { ok: true, data: { candidate_id: candidate.id } };
}

// ---------------------------------------------------------------------------
// Internal: status transition helper
// ---------------------------------------------------------------------------
async function transitionStatus(
  jsaId: string,
  fromStatus: JsaRow["status"],
  toStatus: JsaRow["status"],
  requiredPerm: "jsa:draft" | "jsa:approve",
  verb: string,
): Promise<ActionResult<void>> {
  const { supabase, user } = await requireUser();

  const { data: jsa, error: readErr } = await supabase
    .from("jsas")
    .select("id, site_id, status, created_by")
    .eq("id", jsaId)
    .is("deleted_at", null)
    .single();
  if (readErr || !jsa) return { ok: false, error: readErr?.message ?? "JSA not found" };

  if (jsa.status !== fromStatus) {
    return { ok: false, error: `JSA is in ${jsa.status} state; expected ${fromStatus}.` };
  }
  if (!(await can(requiredPerm, jsa.site_id))) {
    return { ok: false, error: `Forbidden: missing ${requiredPerm}` };
  }

  const { error: updateErr } = await supabase
    .from("jsas")
    .update({ status: toStatus })
    .eq("id", jsaId);
  if (updateErr) return { ok: false, error: updateErr.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb,
    jsa_id: jsaId,
    payload: { jsa_id: jsaId, from: fromStatus, to: toStatus },
  });

  revalidatePath(`/jsa/${jsaId}`);
  revalidatePath("/jsa");
  return { ok: true };
}

function defaultExpiryDate(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}
