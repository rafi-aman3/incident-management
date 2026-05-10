/**
 * Notification engine — pure function. Maps the fully-classified incident
 * (type, severity, jurisdiction + injury specifics) to the regulatory clocks
 * that fire at classification per SPEC §9.
 *
 * Returns the deadlines that should be inserted into `notifications`. Caller
 * is responsible for atomicity (see `lib/workflow/finalize-incident.ts` →
 * classify_incident_v1 RPC).
 *
 * Sandbox incidents skip this engine entirely — that check happens in the
 * RPC, not here, so the engine stays pure.
 */

import type { SeverityCode } from "./severity";
import type { IncidentType } from "./routing";
import type { RiddorSpecifiedInjury } from "@/lib/constants/riddor";

export type NotificationKind =
  | "osha_8hr"
  | "osha_24hr"
  | "riddor_immediate"
  | "riddor_f2508_10d"
  | "riddor_7day"
  | "riddor_disease"
  | "capa_overdue"
  | "capa_escalated"
  | "assigned"
  | "stop_work_raised";

/**
 * Site jurisdiction. Driven by sites.country in v1; setup_progress.regulator
 * may override to 'both' for hybrid sites.
 */
export type Jurisdiction = "osha" | "hse" | "both";

export type NotificationsInput = {
  type: IncidentType;
  severity: SeverityCode;
  jurisdiction: Jurisdiction;
  occurredAt: Date;
  /** From injured_persons aggregate. */
  anyFatality?: boolean;
  anyHospitalization?: boolean;
  anyAmputation?: boolean;
  anyEyeLoss?: boolean;
  /** Most-severe specified injury across injured_persons (or null if none). */
  riddorSpecifiedInjury?: RiddorSpecifiedInjury | null;
  /** Set true once the 7th day of incapacitation passes — not at initial classification. */
  over7DayConfirmed?: boolean;
  /** Confirmed occupational disease diagnosis. */
  occupationalDiseaseConfirmed?: boolean;
};

export type RegulatoryDeadline = {
  kind: NotificationKind;
  /** ISO timestamp when the deadline lapses. */
  deadlineAt: string;
  title: string;
  body: string;
};

const HOURS_MS = 3_600_000;
const DAYS_MS = 86_400_000;

function fromOccurredAt(occurredAt: Date, deltaMs: number): string {
  return new Date(occurredAt.getTime() + deltaMs).toISOString();
}

export function computeRegulatoryDeadlines(input: NotificationsInput): RegulatoryDeadline[] {
  const out: RegulatoryDeadline[] = [];
  const { jurisdiction, occurredAt } = input;

  const oshaActive = jurisdiction === "osha" || jurisdiction === "both";
  const riddorActive = jurisdiction === "hse" || jurisdiction === "both";

  // ------------------- OSHA (US) -------------------
  if (oshaActive) {
    if (input.anyFatality) {
      out.push({
        kind: "osha_8hr",
        deadlineAt: fromOccurredAt(occurredAt, 8 * HOURS_MS),
        title: "OSHA 8-hour fatality report",
        body: "Phone OSHA Area Office immediately — within 8 hours of occurrence.",
      });
    }
    if (input.anyAmputation || input.anyHospitalization || input.anyEyeLoss) {
      out.push({
        kind: "osha_24hr",
        deadlineAt: fromOccurredAt(occurredAt, 24 * HOURS_MS),
        title: "OSHA 24-hour report",
        body: "Phone or online report to OSHA — amputation, eye loss, or in-patient hospitalization within 24 hours.",
      });
    }
  }

  // ------------------- RIDDOR (UK) -------------------
  if (riddorActive) {
    const isDangerousOccurrence = input.type === "dangerous_occurrence";
    const hasSpecifiedInjury = Boolean(input.riddorSpecifiedInjury);
    const isFatality = Boolean(input.anyFatality);

    if (isFatality || hasSpecifiedInjury || isDangerousOccurrence) {
      // Immediate phone + F2508 within 10 days
      out.push({
        kind: "riddor_immediate",
        deadlineAt: fromOccurredAt(occurredAt, 0),
        title: "RIDDOR immediate phone notification",
        body: "Phone HSE before submitting written F2508.",
      });
      out.push({
        kind: "riddor_f2508_10d",
        deadlineAt: fromOccurredAt(occurredAt, 10 * DAYS_MS),
        title: "RIDDOR F2508 (10-day written submission)",
        body: "Submit the F2508 form to HSE within 10 days of the incident.",
      });
    }

    if (input.over7DayConfirmed) {
      out.push({
        kind: "riddor_7day",
        deadlineAt: fromOccurredAt(occurredAt, 15 * DAYS_MS),
        title: "RIDDOR over-7-day injury",
        body: "Submit F2508 within 15 days of the accident.",
      });
    }

    if (input.occupationalDiseaseConfirmed) {
      out.push({
        kind: "riddor_disease",
        deadlineAt: fromOccurredAt(occurredAt, 0),
        title: "RIDDOR occupational disease",
        body: "Submit F2508 on receipt of the diagnosis.",
      });
    }
  }

  return out;
}
