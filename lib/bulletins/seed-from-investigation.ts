/**
 * Build the pre-fill payload for a new bulletin authored from a closed
 * investigation. Centralizes the markdown skeleton so future tweaks
 * happen in one place.
 *
 * Inputs come from a single SELECT joining investigations → incidents →
 * sites in the calling page. Anything missing renders as a blank
 * placeholder line; the EHS author fills it in.
 */
export type InvestigationSeedInput = {
  incident: {
    ref_code: string | null;
    title: string;
    description: string | null;
    occurred_at: string; // ISO
    site_name: string | null;
  };
  investigation: {
    ref_code: string | null;
    root_cause_summary: string | null;
    findings: string | null;
  };
};

export function seedBulletinFromInvestigation(input: InvestigationSeedInput) {
  const { incident, investigation } = input;
  const title = `Lessons Learned — ${incident.title}`.slice(0, 200);
  const occurred = new Date(incident.occurred_at).toISOString().slice(0, 10);

  const body = [
    `**Source incident:** ${incident.ref_code ?? "—"} — ${incident.title}`,
    `**Site:** ${incident.site_name ?? "—"}`,
    `**Occurred:** ${occurred}`,
    investigation.ref_code ? `**Investigation:** ${investigation.ref_code}` : null,
    "",
    "## What happened",
    incident.description?.trim() || "_(EHS to fill — describe the event without personal names.)_",
    "",
    "## Root cause",
    investigation.root_cause_summary?.trim() || "_(EHS to fill from investigation root cause.)_",
    "",
    "## Findings",
    investigation.findings?.trim() || "_(EHS to fill from investigation findings.)_",
    "",
    "## What we're doing about it",
    "_(EHS to fill — list the CAPAs and any procedural changes.)_",
    "",
    "## What every worker should do",
    "_(EHS to fill.)_",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { title, body };
}
