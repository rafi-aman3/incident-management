"use server";

/**
 * Incident ↔ hazard linkage (Phase 14).
 *
 * Fires the SPEC-delta notification 'hazard_incident_linked' to the hazard
 * identifier + current-RA assessor. On a CAUSAL link, flips the hazard's
 * status back to 'under_assessment' if it was 'controlled' or 'monitoring' —
 * the prior assessment is no longer credible after a causal incident.
 * Plan-kickoff Q&A confirmed this auto-flip behavior.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";
import {
  LinkIncidentToHazardSchema,
  TriggerReassessmentSchema,
} from "./incident-hazards-schemas";
import { createRiskAssessment } from "./hazards";

// ---------------------------------------------------------------------------
// linkIncidentToHazard
// ---------------------------------------------------------------------------
export async function linkIncidentToHazard(
  input: z.input<typeof LinkIncidentToHazardSchema>,
): Promise<ActionResult<{ id: string; status_flipped: boolean }>> {
  const parsed = LinkIncidentToHazardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid link",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  // Load both sides
  const [{ data: incident }, { data: hazard }] = await Promise.all([
    supabase
      .from("incidents")
      .select("id, ref_code, site_id, occurred_at, severity")
      .eq("id", parsed.data.incident_id)
      .single(),
    supabase
      .from("hazards")
      .select("id, ref_code, site_id, status, identified_by, current_risk_assessment_id, created_at")
      .eq("id", parsed.data.hazard_id)
      .is("deleted_at", null)
      .single(),
  ]);
  if (!incident) return { ok: false, error: "Incident not found" };
  if (!hazard) return { ok: false, error: "Hazard not found" };

  // Permission: investigation lead OR hazard:manage on hazard's site
  const allowed =
    (await can("investigation:lead", incident.site_id)) ||
    (await can("hazard:manage", hazard.site_id));
  if (!allowed) {
    return { ok: false, error: "Forbidden: missing investigation:lead or hazard:manage" };
  }

  // was_in_register_at_time: hazard existed before the incident occurred
  const wasInRegister =
    hazard.created_at !== null &&
    new Date(hazard.created_at).getTime() <= new Date(incident.occurred_at).getTime();

  const { data: link, error: insertErr } = await supabase
    .from("incident_hazard_links")
    .insert({
      incident_id: incident.id,
      hazard_id: hazard.id,
      was_in_register_at_time: wasInRegister,
      link_type: parsed.data.link_type,
      identified_by: user.id,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();
  if (insertErr || !link) {
    return { ok: false, error: insertErr?.message ?? "Insert failed" };
  }

  // Auto-flip: causal link on a previously-controlled/monitoring hazard
  // invalidates the prior assessment.
  let statusFlipped = false;
  if (
    parsed.data.link_type === "causal" &&
    (hazard.status === "controlled" || hazard.status === "monitoring")
  ) {
    await supabase.from("hazards").update({ status: "under_assessment" }).eq("id", hazard.id);
    statusFlipped = true;
  }

  // Fire risk-owner notifications (SPEC delta)
  const recipientIds = new Set<string>();
  if (hazard.identified_by) recipientIds.add(hazard.identified_by);
  if (hazard.current_risk_assessment_id) {
    const { data: ra } = await supabase
      .from("hazard_risk_assessments")
      .select("assessor_id")
      .eq("id", hazard.current_risk_assessment_id)
      .single();
    if (ra?.assessor_id) recipientIds.add(ra.assessor_id);
  }
  recipientIds.delete(user.id); // don't notify the actor

  const notifTitle = `Incident ${incident.ref_code ?? incident.id.slice(0, 8)} linked to ${hazard.ref_code ?? "hazard"} (${parsed.data.link_type})`;
  const notifBody = statusFlipped
    ? `Hazard status flipped back to under_assessment — a new post-incident risk assessment is needed.`
    : `Linked as ${parsed.data.link_type}. Review the incident for context.`;

  for (const recipient of recipientIds) {
    await supabase.from("notifications").insert({
      kind: "hazard_incident_linked",
      incident_id: incident.id,
      site_id: incident.site_id,
      recipient_id: recipient,
      title: notifTitle,
      body: notifBody,
    });
  }

  await supabase.from("activity_events").insert({
    incident_id: incident.id,
    actor_id: user.id,
    verb: "incident.hazard_linked",
    payload: {
      hazard_id: hazard.id,
      hazard_ref_code: hazard.ref_code,
      link_type: parsed.data.link_type,
      status_flipped: statusFlipped,
      notified: Array.from(recipientIds),
    },
  });

  revalidatePath(`/investigations/${incident.id}`);
  revalidatePath(`/incidents/${incident.id}`);
  revalidatePath(`/hazards/${hazard.id}`);
  return { ok: true, data: { id: link.id, status_flipped: statusFlipped } };
}

// ---------------------------------------------------------------------------
// triggerReassessment — explicit post-incident RA from the investigation tab
// ---------------------------------------------------------------------------
export async function triggerReassessment(
  input: z.input<typeof TriggerReassessmentSchema> & {
    likelihood: import("@/lib/risk/types").Likelihood;
    consequence: import("@/lib/risk/types").Consequence;
  },
): Promise<ActionResult<{ assessment_id: string }>> {
  const parsed = TriggerReassessmentSchema.safeParse({
    hazard_id: input.hazard_id,
    from_incident_id: input.from_incident_id,
    rationale: input.rationale,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid trigger",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Delegate to createRiskAssessment with trigger_type='post_incident'.
  const result = await createRiskAssessment(parsed.data.hazard_id, {
    likelihood: input.likelihood,
    consequence: input.consequence,
    trigger_type: "post_incident",
    triggered_by_incident_id: parsed.data.from_incident_id,
    rationale: parsed.data.rationale,
    consulted_worker_ids: [],
  });
  if (!result.ok) return result;

  // Mark the link as having triggered a reassessment
  const { supabase } = await requireUser();
  await supabase
    .from("incident_hazard_links")
    .update({ triggered_reassessment: true })
    .eq("incident_id", parsed.data.from_incident_id)
    .eq("hazard_id", parsed.data.hazard_id);

  return { ok: true, data: { assessment_id: result.data!.id } };
}
