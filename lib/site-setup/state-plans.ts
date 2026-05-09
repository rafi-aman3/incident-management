/**
 * OSHA state plan catalog — used in Step 2 (Jurisdiction) of the Site Setup
 * wizard when `sites.osha_jurisdiction = 'state_plan'`. The 2-letter code is
 * stored on `sites.state_plan_code`.
 *
 * 22 states + Puerto Rico + US Virgin Islands run their own OSHA-approved
 * state plans with their own reporting portals and (sometimes) stricter rules.
 * 6 of these (CT, IL, ME, NJ, NY, plus VI partially) cover state and local
 * government employees only — private-sector employees in those jurisdictions
 * still report to federal OSHA. The wizard surfaces this distinction in help
 * text but doesn't enforce it (admin knows their own employer category).
 *
 * Source: https://www.osha.gov/stateplans (regulatory-stable list).
 */

export type StatePlanScope = "all_employers" | "state_local_only";

export type StatePlan = {
  code: string;
  name: string;
  scope: StatePlanScope;
};

export const STATE_PLANS: ReadonlyArray<StatePlan> = [
  { code: "AK", name: "Alaska",                 scope: "all_employers" },
  { code: "AZ", name: "Arizona",                scope: "all_employers" },
  { code: "CA", name: "California (Cal/OSHA)",  scope: "all_employers" },
  { code: "CT", name: "Connecticut",            scope: "state_local_only" },
  { code: "HI", name: "Hawaii",                 scope: "all_employers" },
  { code: "IA", name: "Iowa",                   scope: "all_employers" },
  { code: "IL", name: "Illinois",               scope: "state_local_only" },
  { code: "IN", name: "Indiana",                scope: "all_employers" },
  { code: "KY", name: "Kentucky",               scope: "all_employers" },
  { code: "ME", name: "Maine",                  scope: "state_local_only" },
  { code: "MD", name: "Maryland",               scope: "all_employers" },
  { code: "MI", name: "Michigan (MIOSHA)",      scope: "all_employers" },
  { code: "MN", name: "Minnesota",              scope: "all_employers" },
  { code: "NV", name: "Nevada",                 scope: "all_employers" },
  { code: "NJ", name: "New Jersey",             scope: "state_local_only" },
  { code: "NM", name: "New Mexico",             scope: "all_employers" },
  { code: "NY", name: "New York",               scope: "state_local_only" },
  { code: "NC", name: "North Carolina",         scope: "all_employers" },
  { code: "OR", name: "Oregon",                 scope: "all_employers" },
  { code: "PR", name: "Puerto Rico",            scope: "all_employers" },
  { code: "SC", name: "South Carolina",         scope: "all_employers" },
  { code: "TN", name: "Tennessee",              scope: "all_employers" },
  { code: "UT", name: "Utah",                   scope: "all_employers" },
  { code: "VT", name: "Vermont",                scope: "all_employers" },
  { code: "VI", name: "US Virgin Islands",      scope: "state_local_only" },
  { code: "VA", name: "Virginia",               scope: "all_employers" },
  { code: "WA", name: "Washington (WA L&I)",    scope: "all_employers" },
  { code: "WY", name: "Wyoming",                scope: "all_employers" },
];

export const STATE_PLAN_CODES = STATE_PLANS.map((sp) => sp.code) as ReadonlyArray<string>;

export function isStatePlanCode(s: string): boolean {
  return STATE_PLAN_CODES.includes(s);
}

export function statePlanByCode(code: string): StatePlan | undefined {
  return STATE_PLANS.find((sp) => sp.code === code);
}
