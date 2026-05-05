/**
 * RIDDOR F2508 field map per the HSE specimen form.
 *
 * F2508 has 5 sections (A–E). For v1 we surface a flat list pre-filled
 * from incidents + injured_persons rows, plus the HSE notification record
 * (separate card on the page).
 *
 * Reference: https://www.hse.gov.uk/forms/incident/f2508.htm
 */

export type F2508Source = {
  incident: {
    ref_code: string | null;
    occurred_at: string;
    area: string | null;
    location: string | null;
    description: string | null;
    dangerous_occurrence_kind: string | null;
  };
  site: {
    name: string;
    address: string | null;
  };
  injured: {
    name: string | null;
    job_title: string | null;
    employment_status: string | null;
    body_parts: string[] | null;
    injury_nature: string | null;
    riddor_specified_injury: string | null;
    fatality: boolean | null;
    date_of_death: string | null;
    days_away: number | null;
  };
};

export type F2508Field = {
  key: string;
  label: string;
  value: string;
  group: "incident" | "person" | "injury";
};

const formatDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString("en-GB") : "—";

const formatTime = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "—";

const SPECIFIED_INJURY_LABELS: Record<string, string> = {
  fracture: "Fracture (other than to fingers, thumbs, toes)",
  amputation: "Amputation of arm, hand, finger, thumb, leg, foot, or toe",
  sight_loss: "Permanent loss of sight or reduction of sight",
  crush_internal: "Crush injury leading to internal organ damage",
  serious_burn: "Serious burn (>10% body or eyes / respiratory / vital organs)",
  scalping: "Scalping requiring hospital treatment",
  loss_of_consciousness: "Loss of consciousness from head injury or asphyxia",
  enclosed_space_injury: "Enclosed-space injury (hypothermia / heat / resuscitation)",
};

export function deriveF2508Fields(src: F2508Source): F2508Field[] {
  const i = src.injured;
  const reportType = i.fatality
    ? "Death"
    : i.riddor_specified_injury
      ? "Specified injury"
      : (i.days_away ?? 0) > 7
        ? "Over-7-day incapacitation"
        : src.incident.dangerous_occurrence_kind
          ? "Dangerous occurrence"
          : "Other reportable event";

  return [
    // About the incident
    { key: "ref", group: "incident", label: "Reference", value: src.incident.ref_code ?? "—" },
    { key: "report_type", group: "incident", label: "Type of reportable event", value: reportType },
    { key: "date", group: "incident", label: "Date of incident", value: formatDate(src.incident.occurred_at) },
    { key: "time", group: "incident", label: "Time of incident", value: formatTime(src.incident.occurred_at) },
    {
      key: "place",
      group: "incident",
      label: "Place where the incident happened",
      value: [src.site.name, src.incident.area, src.incident.location].filter(Boolean).join(" / ") || "—",
    },
    {
      key: "address",
      group: "incident",
      label: "Address of the place",
      value: src.site.address ?? "—",
    },
    {
      key: "description",
      group: "incident",
      label: "Description of the incident",
      value: src.incident.description ?? "—",
    },
    {
      key: "dangerous_kind",
      group: "incident",
      label: "Dangerous occurrence type (if applicable)",
      value: src.incident.dangerous_occurrence_kind ?? "(N/A)",
    },

    // About the person
    { key: "name", group: "person", label: "Name", value: i.name ?? "—" },
    { key: "job_title", group: "person", label: "Job title", value: i.job_title ?? "—" },
    {
      key: "employment_status",
      group: "person",
      label: "Employment status",
      value: i.employment_status ?? "—",
    },

    // About the injury
    {
      key: "nature",
      group: "injury",
      label: "Nature of the injury",
      value: i.injury_nature ?? "—",
    },
    {
      key: "body_part",
      group: "injury",
      label: "Part of the body injured",
      value: (i.body_parts ?? []).join(", ") || "—",
    },
    {
      key: "specified",
      group: "injury",
      label: "Specified injury (RIDDOR 2013, Schedule 1)",
      value: i.riddor_specified_injury
        ? (SPECIFIED_INJURY_LABELS[i.riddor_specified_injury] ?? i.riddor_specified_injury)
        : "(N/A)",
    },
    {
      key: "days_away",
      group: "injury",
      label: "Days unable to do normal work",
      value: i.days_away !== null ? String(i.days_away) : "—",
    },
    {
      key: "fatality",
      group: "injury",
      label: "Fatal?",
      value: i.fatality ? `Yes — date of death ${formatDate(i.date_of_death)}` : "No",
    },
  ];
}

export const F2508_FIELD_GROUPS: Array<{ key: F2508Field["group"]; label: string }> = [
  { key: "incident", label: "About the incident" },
  { key: "person", label: "About the person who was injured" },
  { key: "injury", label: "About the injury" },
];
