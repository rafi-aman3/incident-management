/**
 * Severity engine — pure function. Maps the user's 5×5 risk matrix selection
 * (likelihood × consequence) to one of the five severity codes per SPEC §8.
 *
 * Likelihood (rows): 1=Rare, 2=Unlikely, 3=Possible, 4=Likely, 5=Almost Certain
 * Consequence (cols): 1=Insignificant, 2=Minor, 3=Moderate, 4=Major, 5=Catastrophic
 *
 * As of Phase 14 (2026-05-11) the lookup table lives in `lib/risk/matrix.ts`
 * and is shared with the hazard register. This module remains the integer-
 * coordinate adapter the incident wizard depends on. No behavior change.
 */

import { computeRisk } from "@/lib/risk/matrix";
import {
  likelihoodFromCoord,
  consequenceFromCoord,
  type MatrixCoord,
} from "@/lib/risk/coords";
import type { RiskLevel } from "@/lib/risk/types";

export type SeverityCode = RiskLevel;
export type { MatrixCoord };

export function computeSeverity(input: {
  likelihood: MatrixCoord;
  consequence: MatrixCoord;
}): SeverityCode {
  const { likelihood, consequence } = input;
  if (
    likelihood < 1 ||
    likelihood > 5 ||
    consequence < 1 ||
    consequence > 5
  ) {
    throw new Error(
      `Invalid matrix coords: likelihood=${likelihood}, consequence=${consequence}`,
    );
  }
  return computeRisk(
    likelihoodFromCoord(likelihood),
    consequenceFromCoord(consequence),
  );
}

export const LIKELIHOOD_LABELS = [
  "Rare",
  "Unlikely",
  "Possible",
  "Likely",
  "Almost Certain",
] as const;
export const CONSEQUENCE_LABELS = [
  "Insignificant",
  "Minor",
  "Moderate",
  "Major",
  "Catastrophic",
] as const;
export const SEVERITY_LABELS: Record<SeverityCode, string> = {
  S1: "Critical",
  S2: "Major",
  S3: "Moderate",
  S4: "Minor",
  S5: "Insignificant",
};
