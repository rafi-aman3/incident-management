"use server";

import { requireUser } from "@/lib/supabase/auth";
import { computeSeverity, type MatrixCoord, type SeverityCode } from "./severity";
import { computeTrack, type IncidentType, type Treatment } from "./routing";
import {
  computeRegulatoryDeadlines,
  type Jurisdiction,
  type NotificationsInput,
} from "./notifications";
import type { RiddorSpecifiedInjury } from "@/lib/constants/riddor";
import type { ActionResult } from "@/lib/site-setup/schemas";

/**
 * The workflow atom — called from Wizard step 3 finalize, from severity-override
 * triage, and any other path that wants to (re-)classify an incident.
 *
 * Flow:
 *   1. Load the incident + injured_persons rows
 *   2. Run severity + routing + notifications engines in JS
 *   3. Call classify_incident_v1 RPC for atomic write
 *
 * Returns ActionResult so callers can `useActionState` and surface errors.
 */
export async function finalizeIncident(input: {
  incidentId: string;
  likelihood: MatrixCoord;
  consequence: MatrixCoord;
}): Promise<ActionResult<{ severity: SeverityCode; track: "A" | "B" | "C" }>> {
  const { supabase, user } = await requireUser();

  // 1. Load incident + injured_persons + site jurisdiction
  const { data: incident, error: incErr } = await supabase
    .from("incidents")
    .select(
      "id, type, occurred_at, status, is_sandbox, site_id, sites:site_id(country, setup_progress)"
    )
    .eq("id", input.incidentId)
    .single();
  if (incErr || !incident) return { ok: false, error: incErr?.message ?? "Incident not found" };
  if (incident.status !== "draft" && incident.status !== "submitted") {
    return { ok: false, error: `Incident already classified (status=${incident.status})` };
  }

  const { data: injured } = await supabase
    .from("injured_persons")
    .select("treatment, fatality, hospitalized, riddor_specified_injury")
    .eq("incident_id", input.incidentId);
  const injuredRows = injured ?? [];

  // Aggregate injury signals
  const treatmentRank: Record<Treatment, number> = {
    none: 0,
    first_aid: 1,
    medical: 2,
    hospitalization: 3,
  };
  let worstTreatment: Treatment | null = null;
  let anyFatality = false;
  let anyHospitalization = false;
  let anyAmputation = false;
  let anyEyeLoss = false;
  let mostSevereSpecifiedInjury: RiddorSpecifiedInjury | null = null;
  for (const row of injuredRows) {
    const t = (row.treatment ?? null) as Treatment | null;
    if (t && (worstTreatment === null || treatmentRank[t] > treatmentRank[worstTreatment])) {
      worstTreatment = t;
    }
    if (row.fatality) anyFatality = true;
    if (row.hospitalized) anyHospitalization = true;
    const rsi = row.riddor_specified_injury as RiddorSpecifiedInjury | null;
    if (rsi === "amputation") anyAmputation = true;
    if (rsi === "sight_loss") anyEyeLoss = true;
    if (rsi && !mostSevereSpecifiedInjury) mostSevereSpecifiedInjury = rsi;
  }

  // Jurisdiction: setup_progress.regulator if set, else derived from country
  const country = (incident.sites?.country ?? "US") as "US" | "GB";
  const setupProgress = (incident.sites?.setup_progress ?? {}) as { regulator?: Jurisdiction };
  const jurisdiction: Jurisdiction =
    setupProgress.regulator ?? (country === "US" ? "osha" : "hse");

  // 2. Run engines
  const severity = computeSeverity({
    likelihood: input.likelihood,
    consequence: input.consequence,
  });

  const { track } = computeTrack({
    severity,
    type: incident.type as IncidentType,
    worstTreatment,
    anyFatality,
    anyHospitalization,
  });

  const notificationsInput: NotificationsInput = {
    type: incident.type as IncidentType,
    severity,
    jurisdiction,
    occurredAt: new Date(incident.occurred_at),
    anyFatality,
    anyHospitalization,
    anyAmputation,
    anyEyeLoss,
    riddorSpecifiedInjury: mostSevereSpecifiedInjury,
  };
  const deadlines = computeRegulatoryDeadlines(notificationsInput);

  // 3. Atomic write via RPC
  const { error: rpcErr } = await supabase.rpc("classify_incident_v1", {
    p_incident_id: input.incidentId,
    p_severity: severity,
    p_track: track,
    p_deadlines: deadlines.map((d) => ({
      kind: d.kind,
      deadlineAt: d.deadlineAt,
      title: d.title,
      body: d.body,
    })),
    p_actor_id: user.id,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  return { ok: true, data: { severity, track } };
}
