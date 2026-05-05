/**
 * OSHA Form 301 field map. Per Form 301 (rev. 1/2004), 18 fields total
 * grouped into Information about the employee, Information about the
 * physician, and Information about the case.
 *
 * For v1 we render the 18 fields as a read-only list pre-filled from
 * the incidents + injured_persons rows; structured edit lands in v2.
 * The PDF generator (D5) reads off this same shape.
 */

export type Osha301Source = {
  incident: {
    ref_code: string | null;
    occurred_at: string;
    area: string | null;
    location: string | null;
    description: string | null;
  };
  site: {
    name: string;
    address: string | null;
  };
  injured: {
    name: string | null;
    job_title: string | null;
    department: string | null;
    body_parts: string[] | null;
    injury_nature: string | null;
    object_substance: string | null;
    treatment: string | null;
    days_away: number | null;
    days_restricted: number | null;
    fatality: boolean | null;
    date_of_death: string | null;
  };
  reporter: {
    full_name: string | null;
    email: string;
  } | null;
};

export type Osha301Field = {
  key: string;
  /** Form-301 field number (1–18). */
  num: number;
  label: string;
  value: string;
  group: "employee" | "physician" | "case";
};

const formatDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString() : "—";

const formatTime = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

export function deriveOsha301Fields(src: Osha301Source): Osha301Field[] {
  const i = src.injured;
  return [
    // Information about the employee (1–7)
    { key: "name", num: 1, group: "employee", label: "Full name", value: i.name ?? "—" },
    { key: "address", num: 2, group: "employee", label: "Street / city / state / zip", value: "(captured at HR — not stored in v1)" },
    { key: "dob", num: 3, group: "employee", label: "Date of birth", value: "(not stored in v1)" },
    { key: "hired", num: 4, group: "employee", label: "Date hired", value: "(not stored in v1)" },
    { key: "sex", num: 5, group: "employee", label: "Sex", value: "(not stored in v1)" },

    // Information about the physician (6–9)
    { key: "physician", num: 6, group: "physician", label: "Name of physician or other health-care professional", value: "(captured at HR — not stored in v1)" },
    { key: "treated_at", num: 7, group: "physician", label: "Treated at facility", value: "(not stored in v1)" },
    { key: "er", num: 8, group: "physician", label: "Treated in emergency room?", value: i.treatment === "hospitalization" ? "Yes" : "No" },
    { key: "hospitalized", num: 9, group: "physician", label: "Hospitalized overnight as in-patient?", value: i.treatment === "hospitalization" ? "Yes" : "No" },

    // Information about the case (10–18)
    { key: "case_number", num: 10, group: "case", label: "Case number from the Log", value: src.incident.ref_code ?? "—" },
    { key: "date_of_injury", num: 11, group: "case", label: "Date of injury or illness", value: formatDate(src.incident.occurred_at) },
    { key: "time_began_work", num: 12, group: "case", label: "Time employee began work", value: "(not stored in v1)" },
    { key: "time_of_event", num: 13, group: "case", label: "Time of event", value: formatTime(src.incident.occurred_at) },
    {
      key: "what_doing",
      num: 14,
      group: "case",
      label: "What was the employee doing just before the incident occurred?",
      value: src.incident.description ?? "—",
    },
    {
      key: "what_happened",
      num: 15,
      group: "case",
      label: "What happened? Tell us how the injury occurred.",
      value: src.incident.description ?? "—",
    },
    {
      key: "injury_specific",
      num: 16,
      group: "case",
      label: "What was the injury or illness? List the parts of body affected and how it was affected.",
      value:
        [i.injury_nature, (i.body_parts ?? []).join(", ")].filter(Boolean).join(" — ") ||
        "—",
    },
    {
      key: "object_substance",
      num: 17,
      group: "case",
      label: "What object or substance directly harmed the employee?",
      value: i.object_substance ?? "—",
    },
    {
      key: "date_of_death",
      num: 18,
      group: "case",
      label: "If the employee died, when did death occur?",
      value: i.fatality ? formatDate(i.date_of_death) : "(N/A)",
    },
  ];
}

export const OSHA_301_FIELD_GROUPS: Array<{
  key: Osha301Field["group"];
  label: string;
}> = [
  { key: "employee", label: "Information about the employee" },
  { key: "physician", label: "Information about the physician or health-care professional" },
  { key: "case", label: "Information about the case" },
];
