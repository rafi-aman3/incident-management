"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";

// ---------------------------------------------------------------------------
// 5-Why row save (autosave debounced 1s on the client). Upserts on the
// (investigation_id, level) unique key so 5 rows max ever exist per chain.
// ---------------------------------------------------------------------------
const SaveWhySchema = z.object({
  investigation_id: z.string().uuid(),
  level: z.coerce.number().int().min(1).max(5),
  question: z.string().max(2000).optional().or(z.literal("")),
  answer: z.string().max(5000).optional().or(z.literal("")),
});

export async function saveWhy(input: {
  investigation_id: string;
  level: number;
  question: string;
  answer: string;
}): Promise<ActionResult> {
  const parsed = SaveWhySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, currentSiteId } = await requireUser();
  await requirePermission("investigation:edit", currentSiteId);

  const { error } = await supabase.from("rca_whys").upsert(
    {
      investigation_id: parsed.data.investigation_id,
      level: parsed.data.level,
      question: parsed.data.question || null,
      answer: parsed.data.answer || null,
    },
    { onConflict: "investigation_id,level" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Findings + root cause summary save — both autosave from the detail page.
// Separate column writes (findings vs root_cause_summary) per SPEC §5.
// ---------------------------------------------------------------------------
const SaveTextFieldSchema = z.object({
  investigation_id: z.string().uuid(),
  field: z.enum(["findings", "root_cause_summary"]),
  value: z.string().max(20000),
});

export async function saveInvestigationText(input: {
  investigation_id: string;
  field: "findings" | "root_cause_summary";
  value: string;
}): Promise<ActionResult> {
  const parsed = SaveTextFieldSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, currentSiteId } = await requireUser();
  await requirePermission("investigation:edit", currentSiteId);

  const patch: { findings?: string | null; root_cause_summary?: string | null } = {};
  patch[parsed.data.field] = parsed.data.value || null;

  const { error } = await supabase
    .from("investigations")
    .update(patch)
    .eq("id", parsed.data.investigation_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Evidence — metadata row written after a direct browser upload to the
// investigation-evidence bucket. Path prefix is enforced by storage RLS:
//   <investigation_id>/<uuid>.<ext>
// ---------------------------------------------------------------------------
const AttachEvidenceSchema = z.object({
  investigation_id: z.string().uuid(),
  storage_path: z.string().min(1).max(500),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().max(120).optional().or(z.literal("")),
  size_bytes: z.number().int().nonnegative().optional(),
});

export async function attachInvestigationEvidence(input: {
  investigation_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = AttachEvidenceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("investigation:edit", currentSiteId);

  const { data, error: insErr } = await supabase
    .from("investigation_evidence")
    .insert({
      investigation_id: parsed.data.investigation_id,
      storage_path: parsed.data.storage_path,
      file_name: parsed.data.file_name,
      mime_type: parsed.data.mime_type || null,
      size_bytes: parsed.data.size_bytes ?? null,
      uploaded_by: user.id,
      type: parsed.data.mime_type?.startsWith("image/") ? "photo" : "document",
    })
    .select("id")
    .single();
  if (insErr || !data) return { ok: false, error: insErr?.message ?? "Insert failed" };

  await supabase.from("activity_events").insert({
    investigation_id: parsed.data.investigation_id,
    actor_id: user.id,
    verb: "evidence.uploaded",
    payload: { file_name: parsed.data.file_name },
  });

  revalidatePath(`/investigations/${parsed.data.investigation_id}`);
  return { ok: true, data: { id: data.id } };
}

const DeleteEvidenceSchema = z.object({
  investigation_id: z.string().uuid(),
  evidence_id: z.string().uuid(),
});

/**
 * Used directly as a `<form action={deleteInvestigationEvidence}>` so the
 * signature is `(fd) => Promise<void>` rather than ActionResult-returning.
 * Errors throw and surface via the Next error boundary; that's acceptable
 * because the only failure modes are permission denials (rare) and stale
 * IDs (also rare).
 */
export async function deleteInvestigationEvidence(fd: FormData): Promise<void> {
  const parsed = DeleteEvidenceSchema.safeParse({
    investigation_id: fd.get("investigation_id"),
    evidence_id: fd.get("evidence_id"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("investigation:edit", currentSiteId);

  const { data: row } = await supabase
    .from("investigation_evidence")
    .select("storage_path, uploaded_by, file_name")
    .eq("id", parsed.data.evidence_id)
    .single();
  if (!row) throw new Error("Evidence not found");

  await supabase.storage.from("investigation-evidence").remove([row.storage_path]);

  const { error: delErr } = await supabase
    .from("investigation_evidence")
    .delete()
    .eq("id", parsed.data.evidence_id);
  if (delErr) throw new Error(delErr.message);

  await supabase.from("activity_events").insert({
    investigation_id: parsed.data.investigation_id,
    actor_id: user.id,
    verb: "evidence.deleted",
    payload: { file_name: row.file_name },
  });

  revalidatePath(`/investigations/${parsed.data.investigation_id}`);
}

// ---------------------------------------------------------------------------
// Close investigation — "no CAPA needed" path
// ---------------------------------------------------------------------------
// The "Assign CAPA" path bundles CAPA create + close in a single RPC and is
// implemented in /capa Section C using assign_capa_from_investigation_v1.
// ---------------------------------------------------------------------------
const CloseNoCapaSchema = z.object({
  investigation_id: z.string().uuid(),
});

export async function closeInvestigationNoCapa(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = CloseNoCapaSchema.safeParse({
    investigation_id: fd.get("investigation_id"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("investigation:edit", currentSiteId);

  const { data: inv, error: readErr } = await supabase
    .from("investigations")
    .select("id, status, incident_id")
    .eq("id", parsed.data.investigation_id)
    .is("deleted_at", null)
    .single();
  if (readErr || !inv) {
    return { ok: false, error: readErr?.message ?? "Investigation not found" };
  }
  if (inv.status === "closed") {
    return { ok: false, error: "Investigation already closed" };
  }

  const { error: updErr } = await supabase
    .from("investigations")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", parsed.data.investigation_id);
  if (updErr) return { ok: false, error: updErr.message };

  // Bump source incident from under_investigation → closed (only when it was
  // actively under investigation; awaiting_capa stays put).
  await supabase
    .from("incidents")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", inv.incident_id)
    .eq("status", "under_investigation");

  await supabase.from("activity_events").insert({
    investigation_id: parsed.data.investigation_id,
    incident_id: inv.incident_id,
    actor_id: user.id,
    verb: "investigation.closed_no_capa",
    payload: {},
  });

  revalidatePath("/investigations");
  revalidatePath(`/investigations/${parsed.data.investigation_id}`);
  redirect("/investigations");
}

// ---------------------------------------------------------------------------
// Investigation team — add / remove / reassign-lead
// ---------------------------------------------------------------------------
const AddTeamSchema = z.object({
  investigation_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  role: z.enum(["lead", "member", "observer"]),
});

export async function addInvestigationTeamMember(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = AddTeamSchema.safeParse({
    investigation_id: fd.get("investigation_id"),
    profile_id: fd.get("profile_id"),
    role: fd.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, currentSiteId } = await requireUser();
  await requirePermission("investigation:edit", currentSiteId);

  const { error } = await supabase.from("investigation_team_members").upsert(
    {
      investigation_id: parsed.data.investigation_id,
      profile_id: parsed.data.profile_id,
      role: parsed.data.role,
    },
    { onConflict: "investigation_id,profile_id" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/investigations/${parsed.data.investigation_id}`);
  return { ok: true };
}

const RemoveTeamSchema = z.object({
  investigation_id: z.string().uuid(),
  profile_id: z.string().uuid(),
});

export async function removeInvestigationTeamMember(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = RemoveTeamSchema.safeParse({
    investigation_id: fd.get("investigation_id"),
    profile_id: fd.get("profile_id"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, currentSiteId } = await requireUser();
  await requirePermission("investigation:edit", currentSiteId);

  // Block removing the current lead — caller must reassign first
  const { data: inv } = await supabase
    .from("investigations")
    .select("lead_investigator_id")
    .eq("id", parsed.data.investigation_id)
    .single();
  if (inv?.lead_investigator_id === parsed.data.profile_id) {
    return {
      ok: false,
      error: "Reassign the lead before removing this member from the team.",
    };
  }

  const { error } = await supabase
    .from("investigation_team_members")
    .delete()
    .eq("investigation_id", parsed.data.investigation_id)
    .eq("profile_id", parsed.data.profile_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/investigations/${parsed.data.investigation_id}`);
  return { ok: true };
}

const ReassignLeadSchema = z.object({
  investigation_id: z.string().uuid(),
  new_lead_id: z.string().uuid(),
});

export async function reassignInvestigationLead(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = ReassignLeadSchema.safeParse({
    investigation_id: fd.get("investigation_id"),
    new_lead_id: fd.get("new_lead_id"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("investigation:lead", currentSiteId);

  const { error: updErr } = await supabase
    .from("investigations")
    .update({ lead_investigator_id: parsed.data.new_lead_id })
    .eq("id", parsed.data.investigation_id);
  if (updErr) return { ok: false, error: updErr.message };

  // Ensure the new lead is in the team table with role=lead
  await supabase.from("investigation_team_members").upsert(
    {
      investigation_id: parsed.data.investigation_id,
      profile_id: parsed.data.new_lead_id,
      role: "lead",
    },
    { onConflict: "investigation_id,profile_id" }
  );

  await supabase.from("activity_events").insert({
    investigation_id: parsed.data.investigation_id,
    actor_id: user.id,
    verb: "investigation.lead_reassigned",
    payload: { new_lead_id: parsed.data.new_lead_id },
  });

  revalidatePath(`/investigations/${parsed.data.investigation_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Witness statement — added on either /incidents/[id] or /investigations/[id];
// stored once in `witnesses` keyed on incident_id, so the read on the
// investigation page picks up incident-phase entries automatically.
// ---------------------------------------------------------------------------
const AddWitnessSchema = z.object({
  incident_id: z.string().uuid(),
  investigation_id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(200),
  contact: z.string().trim().max(200).optional().or(z.literal("")),
  statement: z.string().trim().min(1, "Statement is required").max(5000),
});

export async function addWitnessStatement(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = AddWitnessSchema.safeParse({
    incident_id: fd.get("incident_id"),
    investigation_id: fd.get("investigation_id"),
    name: fd.get("name"),
    contact: fd.get("contact"),
    statement: fd.get("statement"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("investigation:edit", currentSiteId);

  const { error: insErr } = await supabase.from("witnesses").insert({
    incident_id: parsed.data.incident_id,
    name: parsed.data.name,
    contact: parsed.data.contact || null,
    statement: parsed.data.statement,
  });
  if (insErr) return { ok: false, error: insErr.message };

  await supabase.from("activity_events").insert({
    incident_id: parsed.data.incident_id,
    investigation_id: parsed.data.investigation_id,
    actor_id: user.id,
    verb: "witness.statement_added",
    payload: { name: parsed.data.name },
  });

  revalidatePath(`/investigations/${parsed.data.investigation_id}`);
  revalidatePath(`/incidents/${parsed.data.incident_id}`);
  return { ok: true };
}
