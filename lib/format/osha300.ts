/**
 * OSHA 300 Log column derivation per SPEC §7.
 *
 * 13 columns A–M. We render directly off the incidents row joined to
 * injured_persons (sparse-column model per SPEC §10 — one row per case).
 * A case with multiple injured persons becomes multiple log rows.
 *
 * Column F classification:
 *   1 — Injury
 *   2 — Skin disorder
 *   3 — Respiratory condition
 *   4 — Poisoning
 *   5 — Hearing loss
 *   6 — All other illnesses
 */

import { isDartCase } from "./kpi";

export type Osha300SourceRow = {
  case_number: string | null;
  occurred_at: string;
  area: string | null;
  location: string | null;
  description: string | null;
  injured: {
    name: string | null;
    job_title: string | null;
    body_parts: string[] | null;
    injury_nature: string | null;
    object_substance: string | null;
    days_away: number | null;
    days_restricted: number | null;
    fatality: boolean | null;
    treatment: string | null;
  };
};

export type Osha300LogRow = {
  /** A — Case number (incident ref) */
  caseNumber: string;
  /** B — Employee name and job title */
  employee: string;
  /** C — Date of injury or onset of illness */
  date: string;
  /** D — Where the event occurred */
  location: string;
  /** E — Description (injury, body part, object/substance) */
  description: string;
  /** F — Classification (1–6) */
  classification: 1 | 2 | 3 | 4 | 5 | 6;
  /** G — Death */
  death: boolean;
  /** H — Days away from work */
  daysAway: boolean;
  /** I — Job transfer or restriction */
  jobTransferOrRestriction: boolean;
  /** J — Other recordable cases */
  otherRecordable: boolean;
  /** K — Number of days away */
  numDaysAway: number;
  /** L — Number of days of job transfer or restriction */
  numDaysRestricted: number;
  /** M — Injury or illness type code (matches col F) */
  typeCode: 1 | 2 | 3 | 4 | 5 | 6;
};

const ILLNESS_CLASSIFICATIONS: Record<
  string,
  Osha300LogRow["classification"]
> = {
  // Map injury_nature free-text-ish keys to OSHA classification codes.
  // SPEC §10 leaves injury_nature open; this map covers the common cases.
  skin_disorder: 2,
  respiratory: 3,
  poisoning: 4,
  hearing_loss: 5,
  occupational_illness: 6,
};

export function deriveOsha300Row(src: Osha300SourceRow): Osha300LogRow {
  const i = src.injured;
  const daysAway = (i.days_away ?? 0) > 0;
  const restricted = (i.days_restricted ?? 0) > 0;
  const death = !!i.fatality;
  const isDart = isDartCase({
    days_away: i.days_away,
    days_restricted: i.days_restricted,
  });

  // Classification: default to 1 (injury) unless the injury_nature key
  // matches one of the illness buckets.
  const classification: Osha300LogRow["classification"] =
    (i.injury_nature && ILLNESS_CLASSIFICATIONS[i.injury_nature]) || 1;

  // Description (col E): per OSHA — injury/illness, body part, object/substance
  const bodyParts = (i.body_parts ?? []).join(", ");
  const descParts = [
    i.injury_nature,
    bodyParts && `to ${bodyParts}`,
    i.object_substance && `from ${i.object_substance}`,
    src.description,
  ]
    .filter(Boolean)
    .join(" — ");

  return {
    caseNumber: src.case_number ?? "—",
    employee: [i.name, i.job_title].filter(Boolean).join(" — ") || "—",
    date: src.occurred_at,
    location: [src.area, src.location].filter(Boolean).join(" / ") || "—",
    description: descParts || "—",
    classification,
    death,
    daysAway,
    jobTransferOrRestriction: restricted,
    otherRecordable: !death && !daysAway && !restricted && !isDart,
    numDaysAway: i.days_away ?? 0,
    numDaysRestricted: i.days_restricted ?? 0,
    typeCode: classification,
  };
}

export function classificationLabel(c: Osha300LogRow["classification"]): string {
  switch (c) {
    case 1:
      return "Injury";
    case 2:
      return "Skin disorder";
    case 3:
      return "Respiratory";
    case 4:
      return "Poisoning";
    case 5:
      return "Hearing loss";
    case 6:
      return "Other illness";
  }
}
