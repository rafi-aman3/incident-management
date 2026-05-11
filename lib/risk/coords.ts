/**
 * Adapter between the integer-coordinate API used by the incident severity
 * wizard (1-5 likelihood × 1-5 consequence) and the string-named API used by
 * the shared matrix (`Likelihood` × `Consequence`).
 *
 * Kept thin and stable: rewiring the incident wizard to the string API would
 * touch the Phase-1 risk-matrix UI for no behavior gain. Phase 14 introduces
 * a separate string-keyed picker for hazards.
 */

import type { Likelihood, Consequence } from "./types";

export type MatrixCoord = 1 | 2 | 3 | 4 | 5;

export const LIKELIHOOD_BY_COORD = [
  "rare",
  "unlikely",
  "possible",
  "likely",
  "almost_certain",
] as const satisfies readonly Likelihood[];

export const CONSEQUENCE_BY_COORD = [
  "insignificant",
  "minor",
  "moderate",
  "major",
  "catastrophic",
] as const satisfies readonly Consequence[];

export function likelihoodFromCoord(c: MatrixCoord): Likelihood {
  return LIKELIHOOD_BY_COORD[c - 1];
}

export function consequenceFromCoord(c: MatrixCoord): Consequence {
  return CONSEQUENCE_BY_COORD[c - 1];
}

export function coordFromLikelihood(l: Likelihood): MatrixCoord {
  return (LIKELIHOOD_BY_COORD.indexOf(l) + 1) as MatrixCoord;
}

export function coordFromConsequence(c: Consequence): MatrixCoord {
  return (CONSEQUENCE_BY_COORD.indexOf(c) + 1) as MatrixCoord;
}
