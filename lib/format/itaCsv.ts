/**
 * OSHA Injury Tracking Application (ITA) CSV format.
 *
 * The ITA accepts annual establishment data plus a row per recordable case.
 * Real ITA spec changes annually; this targets the 2025 spec at the column-
 * name level. Reference: https://www.osha.gov/injuryreporting (2025 edition).
 *
 * For v1 we ship the case-detail rows only (ITA spec also supports a
 * separate "establishment" header — easier to upload as two files; user
 * generates the establishment row on the OSHA portal directly).
 *
 * NOTE: Real ITA submissions go through the OSHA portal upload, not an
 * API. We generate the file; the user uploads it manually. The /reports
 * page surfaces this guidance in a modal (lands in Section E).
 */

import type { Osha300LogRow } from "./osha300";

export type ItaCaseRow = {
  establishmentId: string | null;
  naics: string | null;
  year: number;
  log: Osha300LogRow;
};

const ITA_COLUMNS = [
  "establishment_id",
  "year",
  "naics_code",
  "case_number",
  "employee_job_title",
  "date_of_injury",
  "where_event_occurred",
  "case_description",
  "classification",
  "death",
  "days_away",
  "job_transfer_or_restriction",
  "other_recordable",
  "num_days_away",
  "num_days_restricted",
  "type_code",
] as const;

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function serializeItaCsv(rows: ItaCaseRow[]): string {
  const lines: string[] = [];
  lines.push(ITA_COLUMNS.join(","));
  for (const r of rows) {
    const cols: Array<string | number | boolean | null> = [
      r.establishmentId,
      r.year,
      r.naics,
      r.log.caseNumber,
      r.log.employee,
      r.log.date,
      r.log.location,
      r.log.description,
      r.log.classification,
      r.log.death ? "Y" : "N",
      r.log.daysAway ? "Y" : "N",
      r.log.jobTransferOrRestriction ? "Y" : "N",
      r.log.otherRecordable ? "Y" : "N",
      r.log.numDaysAway,
      r.log.numDaysRestricted,
      r.log.typeCode,
    ];
    lines.push(cols.map(csvEscape).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
