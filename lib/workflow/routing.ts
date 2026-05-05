/**
 * Routing engine — pure function. Maps {severity, type, type-specific signals}
 * to an investigation track per SPEC §8 "Severity → Track mapping" and the
 * type-specific overrides table beneath it.
 *
 * Track A: full investigation mandatory (S1, S2)
 * Track B: light investigation (S3)
 * Track C: log and close (S4, S5)
 *
 * Overrides shipped in v1:
 *   dangerous_occurrence → always A (RIDDOR-reportable by definition)
 *   observation          → always C (positive observations don't warrant RCA)
 *   injury w/ medical or hospitalization or fatality → A (regardless of matrix)
 *
 * Other overrides (near_miss high-potential, unsafe_condition imminent-danger,
 * environmental reportable-quantity, property-damage scale) need signals not
 * yet collected by the wizard — fall back to matrix output for those.
 */

import type { SeverityCode } from "./severity";

export type TrackCode = "A" | "B" | "C";

export type IncidentType =
  | "injury"
  | "illness"
  | "near_miss"
  | "property_damage"
  | "environmental_release"
  | "unsafe_condition"
  | "observation"
  | "dangerous_occurrence";

export type Treatment = "none" | "first_aid" | "medical" | "hospitalization";

export type RoutingInput = {
  severity: SeverityCode;
  type: IncidentType;
  /** From injured_persons: max severity treatment across all injured. */
  worstTreatment?: Treatment | null;
  /** From injured_persons: any fatality. */
  anyFatality?: boolean;
  /** From injured_persons: any hospitalization. */
  anyHospitalization?: boolean;
};

export type RoutingResult = {
  track: TrackCode;
  reason: string;
};

function severityToTrack(s: SeverityCode): TrackCode {
  if (s === "S1" || s === "S2") return "A";
  if (s === "S3") return "B";
  return "C"; // S4 or S5
}

export function computeTrack(input: RoutingInput): RoutingResult {
  const { severity, type, worstTreatment, anyFatality, anyHospitalization } = input;

  if (type === "dangerous_occurrence") {
    return { track: "A", reason: "Dangerous occurrence — always Track A (RIDDOR-reportable)." };
  }
  if (type === "observation") {
    return { track: "C", reason: "Observation — log only." };
  }
  if (type === "injury") {
    if (anyFatality) return { track: "A", reason: "Injury with fatality — Track A." };
    if (anyHospitalization) return { track: "A", reason: "Injury with hospitalization — Track A." };
    if (worstTreatment === "hospitalization") return { track: "A", reason: "Injury with hospitalization-level treatment — Track A." };
    if (worstTreatment === "medical") {
      // Medical treatment elevates to at least B
      const matrixTrack = severityToTrack(severity);
      if (matrixTrack === "C") return { track: "B", reason: "Injury with medical treatment — minimum Track B." };
    }
  }

  return {
    track: severityToTrack(severity),
    reason: `Severity ${severity} → Track ${severityToTrack(severity)} (matrix default).`,
  };
}
