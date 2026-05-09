/**
 * Site Setup Wizard step config — single source of truth for step
 * numbering, slugs, titles, and progress-key names. Used by the layout
 * chrome and the redirector to resume from the next-incomplete step.
 *
 * Phase 13 reshape: 7 → 9 steps, each with a self-explanatory slug. URLs
 * now read `/admin/site-setup/<slug>` instead of `/admin/site-setup/<n>`.
 *
 * Per docs/onboarding.md §5. Step keys mirror sites.setup_progress jsonb.
 */

export type SetupStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SetupStepSlug =
  | "basics"
  | "jurisdiction"
  | "identifiers"
  | "workforce"
  | "hazards"
  | "departments"
  | "people"
  | "recipients"
  | "confirm";

export type SetupStep = {
  number: SetupStepNumber;
  slug: SetupStepSlug;
  /** Key under sites.setup_progress jsonb that flips to true on save. */
  progressKey: `step${SetupStepNumber}`;
  title: string;
  description: string;
};

export const SETUP_STEPS: ReadonlyArray<SetupStep> = [
  { number: 1, slug: "basics",       progressKey: "step1", title: "Site basics",            description: "Address, location, type, lifecycle." },
  { number: 2, slug: "jurisdiction", progressKey: "step2", title: "Jurisdiction",           description: "Which safety body this site reports to." },
  { number: 3, slug: "identifiers",  progressKey: "step3", title: "Identifiers",            description: "Tax + industry + agency IDs." },
  { number: 4, slug: "workforce",    progressKey: "step4", title: "Workforce",              description: "Headcount + annual hours for OSHA 300A." },
  { number: 5, slug: "hazards",      progressKey: "step5", title: "Hazard profile",         description: "Standards + hazards present at this site." },
  { number: 6, slug: "departments",  progressKey: "step6", title: "Departments & areas",    description: "Where incidents happen — used in the location dropdown." },
  { number: 7, slug: "people",       progressKey: "step7", title: "People",                 description: "EHS lead, responsible person, emergency contacts." },
  { number: 8, slug: "recipients",   progressKey: "step8", title: "Notification recipients", description: "Who gets paged for OSHA / RIDDOR clocks." },
  { number: 9, slug: "confirm",      progressKey: "step9", title: "Confirm & launch",       description: "Review and finish." },
];

export type SetupProgress = Partial<Record<SetupStep["progressKey"], boolean>> & {
  /** Step 6 (departments) — stored in jsonb until promoted to a real table. */
  departments?: { name: string; areas: string[] }[];
};

export function isValidStep(s: number): s is SetupStepNumber {
  return Number.isInteger(s) && s >= 1 && s <= 9;
}

export function isValidSlug(s: string): s is SetupStepSlug {
  return SETUP_STEPS.some((step) => step.slug === s);
}

export function stepBySlug(slug: SetupStepSlug): SetupStep {
  const step = SETUP_STEPS.find((s) => s.slug === slug);
  if (!step) throw new Error(`Unknown step slug: ${slug}`);
  return step;
}

export function stepByNumber(n: SetupStepNumber): SetupStep {
  const step = SETUP_STEPS.find((s) => s.number === n);
  if (!step) throw new Error(`Unknown step number: ${n}`);
  return step;
}

export function nextStepSlug(current: SetupStepSlug): SetupStepSlug | null {
  const idx = SETUP_STEPS.findIndex((s) => s.slug === current);
  if (idx === -1 || idx === SETUP_STEPS.length - 1) return null;
  return SETUP_STEPS[idx + 1]!.slug;
}

/**
 * Returns the slug of the lowest-numbered step that has not been marked
 * complete. Defaults to "basics" when progress is empty.
 */
export function nextIncompleteStep(progress: SetupProgress | null | undefined): SetupStepSlug {
  const p = progress ?? {};
  for (const step of SETUP_STEPS) {
    if (!p[step.progressKey]) return step.slug;
  }
  return "confirm";
}
