"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";
import { finalizeIncident } from "@/lib/workflow/finalize-incident";
import type { MatrixCoord } from "@/lib/workflow/severity";

// ---------------------------------------------------------------------------
// Severity Override
// ---------------------------------------------------------------------------
const SeverityOverrideSchema = z.object({
  incident_id: z.string().uuid(),
  new_severity: z.enum(["S1", "S2", "S3", "S4", "S5"]),
  reason: z.string().trim().min(20, "Reason must be at least 20 characters").max(2000),
});

export async function overrideSeverity(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = SeverityOverrideSchema.safeParse({
    incident_id: fd.get("incident_id"),
    new_severity: fd.get("new_severity"),
    reason: fd.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("incident:override_severity", currentSiteId);

  // Read current severity to write the audit row
  const { data: incident, error: readErr } = await supabase
    .from("incidents")
    .select("id, severity, site_id")
    .eq("id", parsed.data.incident_id)
    .single();
  if (readErr || !incident) return { ok: false, error: readErr?.message ?? "Incident not found" };
  if (!incident.severity)
    return { ok: false, error: "Cannot override severity before classification" };

  // Audit row + UPDATE must be in the same transaction (deferred trigger
  // enforces). Use the same pattern as classify_incident_v1: a SQL helper.
  // For Phase 1 we issue both in one batch and rely on the trigger to fail
  // the UPDATE if the audit insert is missing. Both run via PostgREST inside
  // a single connection — Supabase wraps batched RPC calls per-request.
  const { error: insErr } = await supabase.from("severity_overrides").insert({
    incident_id: incident.id,
    original_severity: incident.severity,
    new_severity: parsed.data.new_severity,
    overridden_by: user.id,
    reason: parsed.data.reason,
  });
  if (insErr) return { ok: false, error: insErr.message };

  const { error: updErr } = await supabase
    .from("incidents")
    .update({ severity: parsed.data.new_severity })
    .eq("id", incident.id);
  if (updErr) return { ok: false, error: updErr.message };

  updateTag("incidents");
  redirect(`/incidents/${incident.id}`);
}

// ---------------------------------------------------------------------------
// Assign Triage Owner — writes an activity_events row in v1
// (no dedicated owner column on incidents; the timeline tells the story).
// ---------------------------------------------------------------------------
const AssignSchema = z.object({
  incident_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function assignTriageOwner(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = AssignSchema.safeParse({
    incident_id: fd.get("incident_id"),
    owner_id: fd.get("owner_id"),
    notes: fd.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("incident:assign", currentSiteId);

  const { error } = await supabase.from("activity_events").insert({
    incident_id: parsed.data.incident_id,
    actor_id: user.id,
    verb: "incident.triage_assigned",
    payload: { owner_id: parsed.data.owner_id, notes: parsed.data.notes || null },
  });
  if (error) return { ok: false, error: error.message };

  updateTag("incidents");
  redirect(`/incidents/${parsed.data.incident_id}`);
}

// ---------------------------------------------------------------------------
// Escalate to Investigation
// ---------------------------------------------------------------------------
const EscalateSchema = z.object({
  incident_id: z.string().uuid(),
  lead_id: z.string().uuid(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
});

export async function escalateToInvestigation(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = EscalateSchema.safeParse({
    incident_id: fd.get("incident_id"),
    lead_id: fd.get("lead_id"),
    due_date: fd.get("due_date"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  const { supabase, currentSiteId } = await requireUser();
  await requirePermission("incident:assign", currentSiteId);

  // Find or create the investigation row
  const { data: incident, error: incErr } = await supabase
    .from("incidents")
    .select("id, site_id, org_id, status")
    .eq("id", parsed.data.incident_id)
    .single();
  if (incErr || !incident) return { ok: false, error: incErr?.message ?? "Incident not found" };

  const { data: existing } = await supabase
    .from("investigations")
    .select("id")
    .eq("incident_id", incident.id)
    .is("deleted_at", null)
    .maybeSingle();

  let invId = existing?.id;
  if (!invId) {
    const { data: created, error: createErr } = await supabase
      .from("investigations")
      .insert({
        incident_id: incident.id,
        site_id: incident.site_id,
        org_id: incident.org_id,
        lead_investigator_id: parsed.data.lead_id,
        due_date: parsed.data.due_date,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (createErr) return { ok: false, error: createErr.message };
    invId = created.id;
  } else {
    const { error: updErr } = await supabase
      .from("investigations")
      .update({
        lead_investigator_id: parsed.data.lead_id,
        due_date: parsed.data.due_date,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .eq("id", invId);
    if (updErr) return { ok: false, error: updErr.message };
  }

  await supabase
    .from("incidents")
    .update({ status: "under_investigation" })
    .eq("id", incident.id);

  updateTag("incidents");
  redirect(`/investigations/${invId}`);
}

// ---------------------------------------------------------------------------
// Close (Track C only)
// ---------------------------------------------------------------------------
const CloseSchema = z.object({
  incident_id: z.string().uuid(),
  reason: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function closeIncident(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = CloseSchema.safeParse({
    incident_id: fd.get("incident_id"),
    reason: fd.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("incident:close", currentSiteId);

  const { data: incident, error: readErr } = await supabase
    .from("incidents")
    .select("id, track, status")
    .eq("id", parsed.data.incident_id)
    .single();
  if (readErr || !incident) return { ok: false, error: readErr?.message ?? "Incident not found" };
  if (incident.track !== "C")
    return { ok: false, error: "Only Track C incidents can be closed directly. Escalate first." };

  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("incidents")
    .update({ status: "closed", closed_at: now })
    .eq("id", incident.id);
  if (updErr) return { ok: false, error: updErr.message };

  await supabase.from("activity_events").insert({
    incident_id: incident.id,
    actor_id: user.id,
    verb: "incident.closed",
    payload: { reason: parsed.data.reason || null },
  });

  updateTag("incidents");
  redirect(`/incidents/${incident.id}`);
}

// Re-export finalizeIncident so the wizard step 3 imports it from one place.
export { finalizeIncident };
export type { MatrixCoord };
