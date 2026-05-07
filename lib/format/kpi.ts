/**
 * OSHA KPIs per SPEC §7 / §9.5.
 *
 * The 200,000 multiplier represents 100 workers × 40 hr/wk × 50 wk/yr
 * (the OSHA standard exposure window). All three OSHA rates return
 * cases or lost-workdays per 200,000 hours worked.
 *
 * RIDDOR / HSE rates use the 1,000,000-hour exposure window — UK
 * convention. ltifr() and trifr() are the GB analogues to dart() and
 * trir() respectively.
 *
 * All rate functions return null when hours_worked is 0 or null —
 * UI renders "—".
 */

export const OSHA_HOURS_MULTIPLIER = 200_000;
export const RIDDOR_HOURS_MULTIPLIER = 1_000_000;

export function trir(
  recordableCases: number,
  hoursWorked: number | null
): number | null {
  if (!hoursWorked || hoursWorked <= 0) return null;
  return (recordableCases * OSHA_HOURS_MULTIPLIER) / hoursWorked;
}

export function dart(
  dartCases: number,
  hoursWorked: number | null
): number | null {
  if (!hoursWorked || hoursWorked <= 0) return null;
  return (dartCases * OSHA_HOURS_MULTIPLIER) / hoursWorked;
}

export function severityRate(
  totalLostWorkdays: number,
  hoursWorked: number | null
): number | null {
  if (!hoursWorked || hoursWorked <= 0) return null;
  return (totalLostWorkdays * OSHA_HOURS_MULTIPLIER) / hoursWorked;
}

// Lost Time Injury Frequency Rate — GB / RIDDOR convention.
// (lost-time injuries × 1,000,000) / hours_worked.
export function ltifr(
  ltiCases: number,
  hoursWorked: number | null
): number | null {
  if (!hoursWorked || hoursWorked <= 0) return null;
  return (ltiCases * RIDDOR_HOURS_MULTIPLIER) / hoursWorked;
}

// Total Recordable Injury Frequency Rate — GB / RIDDOR convention.
// (recordable cases × 1,000,000) / hours_worked.
export function trifr(
  recordableCases: number,
  hoursWorked: number | null
): number | null {
  if (!hoursWorked || hoursWorked <= 0) return null;
  return (recordableCases * RIDDOR_HOURS_MULTIPLIER) / hoursWorked;
}

/**
 * Render a KPI value for the UI. Two decimal places, or "—" when null.
 */
export function formatKpi(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(2);
}

/**
 * A "DART case" — Days Away, Restricted, or Transferred — is a recordable
 * case with at least one of: days_away > 0, days_restricted > 0, or a
 * job transfer (modeled in v2; v1 collapses transfers into days_restricted).
 */
export function isDartCase(person: {
  days_away: number | null;
  days_restricted: number | null;
}): boolean {
  return (person.days_away ?? 0) > 0 || (person.days_restricted ?? 0) > 0;
}
