"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { Step1Schema, Step2Schema, type ActionResult } from "@/lib/incidents/schemas";
import { finalizeIncident as runFinalize } from "@/lib/workflow/finalize-incident";
import type { MatrixCoord } from "@/lib/workflow/severity";

function fieldErrors(error: import("zod").ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    (out[path] ??= []).push(issue.message);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Step 1 — createDraft (legacy). INSERT incidents row in status='draft',
// redirect to step 2 with ?id=<uuid>. Only used by the page-load helper
// `ensureBlankDraft` below — the form submit path now goes through saveStep1
// instead, which UPDATEs the existing draft. Phase 9b switched to
// pre-creating the row on page load so the Argus Form Assistant can target
// `incidentId` from Step 1 onward (its tool calls all need it).
// ---------------------------------------------------------------------------
export async function createDraft(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase, user, profile, currentSiteId } = await requireUser();
  if (!currentSiteId) return { ok: false, error: "No site selected." };

  const parsed = Step1Schema.safeParse({
    type: fd.get("type"),
    title: fd.get("title"),
    occurred_at: fd.get("occurred_at"),
    area: fd.get("area") ?? "",
    location: fd.get("location") ?? "",
    description: fd.get("description") ?? "",
    is_sandbox: fd.get("is_sandbox") === "on" || fd.get("is_sandbox") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrors(parsed.error) };
  }
  const v = parsed.data;

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      org_id: profile.org_id,
      site_id: currentSiteId,
      type: v.type,
      title: v.title,
      description: v.description || null,
      occurred_at: new Date(v.occurred_at).toISOString(),
      area: v.area || null,
      location: v.location || null,
      reporter_id: user.id,
      is_sandbox: Boolean(v.is_sandbox),
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  redirect(`/incidents/new/2?id=${data.id}`);
}

// ---------------------------------------------------------------------------
// Step 1 — saveStep1 (Phase 9b). UPDATE the existing draft created on page
// load via ensureBlankDraft, redirect to step 2 with ?id=<uuid>.
// ---------------------------------------------------------------------------
export async function saveStep1(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  void user;

  const incidentId = (fd.get("incident_id") as string | null) ?? null;
  if (!incidentId) return { ok: false, error: "Missing incident_id" };

  const parsed = Step1Schema.safeParse({
    type: fd.get("type"),
    title: fd.get("title"),
    occurred_at: fd.get("occurred_at"),
    area: fd.get("area") ?? "",
    location: fd.get("location") ?? "",
    description: fd.get("description") ?? "",
    is_sandbox: fd.get("is_sandbox") === "on" || fd.get("is_sandbox") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrors(parsed.error) };
  }
  const v = parsed.data;

  const { error } = await supabase
    .from("incidents")
    .update({
      type: v.type,
      title: v.title,
      description: v.description || null,
      occurred_at: new Date(v.occurred_at).toISOString(),
      area: v.area || null,
      location: v.location || null,
      is_sandbox: Boolean(v.is_sandbox),
    })
    .eq("id", incidentId);
  if (error) return { ok: false, error: error.message };

  redirect(`/incidents/new/2?id=${incidentId}`);
}

// ---------------------------------------------------------------------------
// ensureBlankDraft — server-side helper. On first /incidents/new/1 load
// (no ?id=), creates an empty draft row so the Argus Form Assistant has an
// incidentId to target. Reuses an existing blank draft if one was created
// in the last hour (avoids duplicating on back/forward navigation).
// Returns the incident id; caller redirects.
// ---------------------------------------------------------------------------
export async function ensureBlankDraft(): Promise<string> {
  const { supabase, user, profile, currentSiteId } = await requireUser();
  if (!currentSiteId) {
    throw new Error("No site selected — pick one from the topbar first.");
  }

  // Look for an existing untouched draft from this user in the last hour.
  // 'untouched' = title is empty AND description is null (the blank-draft
  // shape). If the user typed anything and bounced, we treat it as a real
  // draft and let them continue from where they left off.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("incidents")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("status", "draft")
    .eq("title", "")
    .is("description", null)
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // Insert a blank draft. type / title / occurred_at are NOT NULL on the
  // schema, so we seed them with placeholders that the Step 1 form (or
  // Argus auto-fill) will override before submit.
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      org_id: profile.org_id,
      site_id: currentSiteId,
      type: "unsafe_condition",
      title: "",
      occurred_at: new Date().toISOString(),
      reporter_id: user.id,
      status: "draft",
      is_sandbox: false,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Could not create draft: ${error?.message ?? "unknown"}`);
  }
  return data.id;
}

// ---------------------------------------------------------------------------
// Step 2 — saveStep2. UPDATE incident sparse columns; replace injured_persons
// and witnesses for idempotent re-saves. Status stays 'draft' until step 3.
// ---------------------------------------------------------------------------
export async function saveStep2(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  void user;

  const incidentId = fd.get("incident_id") as string | null;
  if (!incidentId) return { ok: false, error: "Missing incident_id" };

  let injuredPersons: unknown[] = [];
  let witnesses: unknown[] = [];
  let ppeWorn: unknown[] = [];
  try {
    injuredPersons = JSON.parse((fd.get("injured_persons_json") as string) || "[]");
    witnesses = JSON.parse((fd.get("witnesses_json") as string) || "[]");
    ppeWorn = JSON.parse((fd.get("ppe_worn_json") as string) || "[]");
  } catch {
    return { ok: false, error: "Could not parse step 2 payload" };
  }

  const parsed = Step2Schema.safeParse({
    likelihood: fd.get("likelihood"),
    consequence: fd.get("consequence"),
    ppe_worn: ppeWorn,
    substance: fd.get("substance") ?? "",
    quantity_value: fd.get("quantity_value") ?? null,
    quantity_unit: fd.get("quantity_unit") ?? "",
    equipment: fd.get("equipment") ?? "",
    equipment_asset_id: (fd.get("equipment_asset_id") as string) || null,
    dangerous_occurrence_kind: fd.get("dangerous_occurrence_kind") ?? "",
    injured_persons: injuredPersons,
    witnesses,
  });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: fieldErrors(parsed.error) };
  }
  const v = parsed.data;

  // Note: likelihood/consequence are NOT persisted on incidents in v1 —
  // they're carried via URL into step 3 and passed to finalizeIncident.
  const { error: incErr } = await supabase
    .from("incidents")
    .update({
      ppe_worn: v.ppe_worn.length ? v.ppe_worn : null,
      substance: v.substance || null,
      quantity_value: v.quantity_value ?? null,
      quantity_unit: v.quantity_unit || null,
      equipment: v.equipment || null,
      equipment_asset_id: v.equipment_asset_id ?? null,
      dangerous_occurrence_kind: v.dangerous_occurrence_kind || null,
    })
    .eq("id", incidentId);
  if (incErr) return { ok: false, error: incErr.message };

  // Replace injured_persons + witnesses (delete + insert)
  await supabase.from("injured_persons").delete().eq("incident_id", incidentId);
  await supabase.from("witnesses").delete().eq("incident_id", incidentId);

  if (v.injured_persons.length > 0) {
    const { error: ipErr } = await supabase.from("injured_persons").insert(
      v.injured_persons.map((p) => ({
        incident_id: incidentId,
        name: p.name,
        body_parts: p.body_parts.length ? p.body_parts : null,
        treatment: p.treatment,
        fatality: p.fatality,
        hospitalized: p.hospitalized,
        riddor_specified_injury: p.riddor_specified_injury || null,
      }))
    );
    if (ipErr) return { ok: false, error: ipErr.message };
  }

  if (v.witnesses.length > 0) {
    const { error: wErr } = await supabase.from("witnesses").insert(
      v.witnesses.map((w) => ({
        incident_id: incidentId,
        name: w.name,
        contact: w.contact || null,
        statement: w.statement || null,
      }))
    );
    if (wErr) return { ok: false, error: wErr.message };
  }

  redirect(`/incidents/new/3?id=${incidentId}&l=${v.likelihood}&c=${v.consequence}`);
}

// ---------------------------------------------------------------------------
// Step 3 — submitIncident. Calls finalizeIncident which composes the three
// engines + classify_incident_v1 RPC. On success redirects to /incidents/[id].
// ---------------------------------------------------------------------------
export async function submitIncident(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const incidentId = fd.get("incident_id") as string | null;
  const likelihood = Number(fd.get("likelihood"));
  const consequence = Number(fd.get("consequence"));
  if (!incidentId) return { ok: false, error: "Missing incident_id" };
  if (![1, 2, 3, 4, 5].includes(likelihood) || ![1, 2, 3, 4, 5].includes(consequence)) {
    return { ok: false, error: "Risk matrix selection missing" };
  }

  // Mark submitted before finalize so the RPC's status check passes
  const { supabase } = await requireUser();
  await supabase.from("incidents").update({ status: "submitted" }).eq("id", incidentId);

  const result = await runFinalize({
    incidentId,
    likelihood: likelihood as MatrixCoord,
    consequence: consequence as MatrixCoord,
  });
  if (!result.ok) return result;

  updateTag("incidents");
  redirect(`/incidents/${incidentId}`);
}
