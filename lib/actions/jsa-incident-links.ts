"use server";

/**
 * JSA ↔ incident linkage (Phase 15).
 *
 * Fires the SPEC-delta notification `jsa_review_required` to the JSA creator
 * and approver. On a CAUSAL link against an approved JSA, flips the JSA's
 * status back to 'under_review' — the prior approval is no longer credible
 * after a causal incident, mirroring §HZ's incident_hazard_links auto-flip.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";
import { LinkJsaIncidentSchema } from "./jsa-schemas";

export async function linkJsaToIncident(
  jsaId: string,
  input: z.input<typeof LinkJsaIncidentSchema>,
): Promise<ActionResult<{ id: string; status_flipped: boolean }>> {
  const parsed = LinkJsaIncidentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid link",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, user } = await requireUser();

  const [{ data: jsa }, { data: incident }] = await Promise.all([
    supabase
      .from("jsas")
      .select("id, ref_code, site_id, title, status, created_by, approved_by")
      .eq("id", jsaId)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("incidents")
      .select("id, ref_code, site_id, severity")
      .eq("id", parsed.data.incident_id)
      .single(),
  ]);
  if (!jsa) return { ok: false, error: "JSA not found" };
  if (!incident) return { ok: false, error: "Incident not found" };

  if (!(await can("investigation:lead", incident.site_id))) {
    return { ok: false, error: "Forbidden: missing investigation:lead" };
  }

  // Insert the link (unique constraint catches duplicates).
  const { data: link, error: insertErr } = await supabase
    .from("jsa_incident_links")
    .insert({
      jsa_id: jsa.id,
      incident_id: incident.id,
      link_type: parsed.data.link_type,
      identified_by: user.id,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();
  if (insertErr || !link) {
    if (insertErr?.code === "23505") {
      return { ok: false, error: "This JSA is already linked to this incident." };
    }
    return { ok: false, error: insertErr?.message ?? "Insert failed" };
  }

  // Causal link on an approved JSA → flip back to under_review.
  let statusFlipped = false;
  if (parsed.data.link_type === "causal" && jsa.status === "approved") {
    await supabase
      .from("jsas")
      .update({ status: "under_review" })
      .eq("id", jsa.id);
    await supabase
      .from("jsa_incident_links")
      .update({ triggered_review: true })
      .eq("id", link.id);
    statusFlipped = true;
  }

  // Fire JSA-review notifications to creator + approver (skip the actor).
  const recipientIds = new Set<string>();
  if (jsa.created_by) recipientIds.add(jsa.created_by);
  if (jsa.approved_by) recipientIds.add(jsa.approved_by);
  recipientIds.delete(user.id);

  const sevLabel = incident.severity ? ` (${incident.severity})` : "";
  const refLabel = incident.ref_code ?? incident.id.slice(0, 8);
  const title = `Incident ${refLabel}${sevLabel} linked to JSA ${jsa.ref_code ?? "—"} as ${parsed.data.link_type}`;
  const body = statusFlipped
    ? `JSA status flipped back to under_review — a post-incident reassessment is needed before re-approval.`
    : `JSA linked as ${parsed.data.link_type} factor. Review the incident for context.`;

  for (const recipient of recipientIds) {
    await supabase.from("notifications").insert({
      kind: "jsa_review_required",
      incident_id: incident.id,
      site_id: jsa.site_id,
      recipient_id: recipient,
      title,
      body,
    });
  }

  await supabase.from("activity_events").insert({
    incident_id: incident.id,
    actor_id: user.id,
    verb: "jsa.incident_linked",
    jsa_id: jsa.id,
    payload: {
      jsa_id: jsa.id,
      jsa_ref_code: jsa.ref_code,
      incident_id: incident.id,
      link_type: parsed.data.link_type,
      status_flipped: statusFlipped,
      notified: Array.from(recipientIds),
    },
  });

  revalidatePath(`/jsa/${jsa.id}`);
  revalidatePath(`/investigations/${incident.id}`);
  revalidatePath(`/incidents/${incident.id}`);
  return { ok: true, data: { id: link.id, status_flipped: statusFlipped } };
}
