/**
 * Build the pre-fill payload for a new bulletin authored from a closed
 * investigation. Centralizes the HTML skeleton so future tweaks happen
 * in one place.
 *
 * Inputs come from a single SELECT joining investigations → incidents →
 * sites in the calling page. Anything missing renders as a blank
 * placeholder line; the EHS author fills it in via the rich-text editor.
 *
 * Emits HTML (TipTap's storage format). The renderer in
 * `components/bulletins/bulletin-body.tsx` re-sanitizes before display.
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

  const placeholder = (text: string) => `<p><em>(${text})</em></p>`;
  const paragraph = (text: string | null | undefined, fallback: string) =>
    text && text.trim()
      ? `<p>${escapeHtml(text.trim()).replace(/\n+/g, "</p><p>")}</p>`
      : placeholder(fallback);

  const sourceLine = [
    `<strong>Source incident:</strong> ${escapeHtml(incident.ref_code ?? "—")} — ${escapeHtml(incident.title)}`,
    `<strong>Site:</strong> ${escapeHtml(incident.site_name ?? "—")}`,
    `<strong>Occurred:</strong> ${escapeHtml(occurred)}`,
    investigation.ref_code
      ? `<strong>Investigation:</strong> ${escapeHtml(investigation.ref_code)}`
      : null,
  ]
    .filter((s): s is string => s !== null)
    .join("<br/>");

  const body = [
    `<p>${sourceLine}</p>`,
    `<h2>What happened</h2>`,
    paragraph(incident.description, "EHS to fill — describe the event without personal names."),
    `<h2>Root cause</h2>`,
    paragraph(investigation.root_cause_summary, "EHS to fill from investigation root cause."),
    `<h2>Findings</h2>`,
    paragraph(investigation.findings, "EHS to fill from investigation findings."),
    `<h2>What we're doing about it</h2>`,
    placeholder("EHS to fill — list the CAPAs and any procedural changes."),
    `<h2>What every worker should do</h2>`,
    placeholder("EHS to fill."),
  ].join("");

  return { title, body };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
