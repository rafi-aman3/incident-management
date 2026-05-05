/**
 * Site Setup Wizard step config — single source of truth for step
 * numbering, titles, and progress-key names. Used by the layout chrome
 * and the redirector to resume from the next-incomplete step.
 *
 * Per docs/onboarding.md §5. Step keys mirror sites.setup_progress jsonb.
 */

export type SetupStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SetupStep = {
  number: SetupStepNumber;
  /** Key under sites.setup_progress jsonb that flips to true on save. */
  progressKey: `step${SetupStepNumber}`;
  title: string;
  description: string;
};

export const SETUP_STEPS: ReadonlyArray<SetupStep> = [
  { number: 1, progressKey: "step1", title: "Site basics",            description: "Name, address, country, time zone." },
  { number: 2, progressKey: "step2", title: "Regulator",              description: "Which safety body this site reports to." },
  { number: 3, progressKey: "step3", title: "Establishment IDs",      description: "OSHA + NAICS, or HSE establishment number." },
  { number: 4, progressKey: "step4", title: "Departments & areas",    description: "Where incidents happen — used in the location dropdown." },
  { number: 5, progressKey: "step5", title: "Users",                  description: "Who's on this site, and at what role." },
  { number: 6, progressKey: "step6", title: "Notification recipients", description: "Who gets paged for OSHA / RIDDOR clocks." },
  { number: 7, progressKey: "step7", title: "Confirm & launch",       description: "Review and finish." },
];

export type SetupProgress = Partial<Record<SetupStep["progressKey"], boolean>> & {
  /** Step 2 selection — stored in jsonb until Phase 2 lifts it to a column. */
  regulator?: "osha" | "hse" | "both";
  /** Step 4 — stored in jsonb until promoted to real tables. */
  departments?: { name: string; areas: string[] }[];
  /** Step 3 — GB sites store HSE establishment number here (no dedicated column yet). */
  hse_establishment_number?: string;
};

/**
 * Returns the lowest-numbered step that has not been marked complete.
 * Defaults to 1 when progress is empty.
 */
export function nextIncompleteStep(progress: SetupProgress | null | undefined): SetupStepNumber {
  const p = progress ?? {};
  for (const step of SETUP_STEPS) {
    if (!p[step.progressKey]) return step.number;
  }
  return 7;
}

export function isValidStep(s: number): s is SetupStepNumber {
  return Number.isInteger(s) && s >= 1 && s <= 7;
}
