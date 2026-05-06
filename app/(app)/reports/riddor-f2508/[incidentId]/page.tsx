import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, Flag } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import {
  deriveF2508Fields,
  F2508_FIELD_GROUPS,
  type F2508Source,
} from "@/lib/format/riddorF2508";
import { PrintButton } from "@/components/reports/print-button";
import {
  HseRecordCard,
  type HseRecord,
} from "@/components/reports/hse-record-card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/info-tooltip";

type Params = Promise<{ incidentId: string }>;

export default async function RiddorF2508Page({ params }: { params: Params }) {
  const { incidentId } = await params;
  const { supabase, currentSiteId } = await requireUser();

  const canRead = currentSiteId
    ? await can("incident:read_site", currentSiteId)
    : false;
  const canExport = currentSiteId
    ? await can("report:export", currentSiteId)
    : false;
  const canEditRecord = currentSiteId
    ? await can("notification:hse_record_edit", currentSiteId)
    : false;

  if (!canRead) notFound();

  const { data: incident, error } = await supabase
    .from("incidents")
    .select(
      `id, ref_code, occurred_at, area, location, description,
       dangerous_occurrence_kind, riddor_reportable, is_sandbox,
       site:site_id ( name, address, country ),
       injured_persons (
         name, job_title, employment_status, body_parts, injury_nature,
         riddor_specified_injury, fatality, date_of_death, days_away
       )`
    )
    .eq("id", incidentId)
    .is("deleted_at", null)
    .single();

  if (error || !incident || !incident.site) notFound();
  // RIDDOR is UK-only — 404 for non-GB sites per ui-flow §8.17.
  if (incident.site.country !== "GB") notFound();

  const ip = (incident.injured_persons ?? [])[0];
  const extraCount = (incident.injured_persons ?? []).length - 1;

  const source: F2508Source = {
    incident: {
      ref_code: incident.ref_code,
      occurred_at: incident.occurred_at,
      area: incident.area,
      location: incident.location,
      description: incident.description,
      dangerous_occurrence_kind: incident.dangerous_occurrence_kind,
    },
    site: {
      name: incident.site.name,
      address: incident.site.address ?? null,
    },
    injured: {
      name: ip?.name ?? null,
      job_title: ip?.job_title ?? null,
      employment_status: ip?.employment_status ?? null,
      body_parts: ip?.body_parts ?? null,
      injury_nature: ip?.injury_nature ?? null,
      riddor_specified_injury: ip?.riddor_specified_injury ?? null,
      fatality: ip?.fatality ?? false,
      date_of_death: ip?.date_of_death ?? null,
      days_away: ip?.days_away ?? null,
    },
  };

  const fields = deriveF2508Fields(source);

  // HSE notification record
  const { data: hseRaw } = await supabase
    .from("hse_notification_records")
    .select(
      "phone_called_at, hse_phone_reference, written_submitted_at, riddor_online_reference, phoned_by:phoned_by ( full_name, email )"
    )
    .eq("incident_id", incident.id)
    .maybeSingle();

  const record: HseRecord = hseRaw
    ? {
        phone_called_at: hseRaw.phone_called_at,
        phoned_by_name:
          hseRaw.phoned_by?.full_name ?? hseRaw.phoned_by?.email ?? null,
        hse_phone_reference: hseRaw.hse_phone_reference,
        written_submitted_at: hseRaw.written_submitted_at,
        riddor_online_reference: hseRaw.riddor_online_reference,
      }
    : null;

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Reports
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <Flag className="h-5 w-5 text-primary" /> RIDDOR F2508
            <InfoTooltip tip="riddor_deadlines" />
          </h1>
          <p className="text-sm text-muted-foreground">
            UK Reporting of Injuries, Diseases and Dangerous Occurrences (RIDDOR)
            2013. Death / specified injury → phone HSE immediately + F2508
            within 10 days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          {canExport && (
            <a
              href={`/api/reports/riddor-f2508/${incident.id}/pdf`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <FileDown className="h-3 w-3" /> Generate PDF
            </a>
          )}
        </div>
      </div>

      {!incident.riddor_reportable && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
          This incident isn&apos;t flagged RIDDOR-reportable. The form renders
          for reference but doesn&apos;t need to be filed.
        </div>
      )}

      <div className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Establishment
          </p>
          <p className="text-sm font-semibold">{incident.site.name}</p>
          {incident.site.address && (
            <p className="text-xs text-muted-foreground">{incident.site.address}</p>
          )}
        </div>
        {F2508_FIELD_GROUPS.map((group) => (
          <FieldGroup
            key={group.key}
            label={group.label}
            fields={fields.filter((f) => f.group === group.key)}
          />
        ))}
      </div>

      {extraCount > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
          {extraCount} additional injured person{extraCount === 1 ? "" : "s"} on this incident.
          File one F2508 per person — v1 demo renders the primary record only.
        </div>
      )}

      <HseRecordCard
        incidentId={incident.id}
        record={record}
        canEdit={canEditRecord}
      />
    </div>
    </TooltipProvider>
  );
}

function FieldGroup({
  label,
  fields,
}: {
  label: string;
  fields: ReturnType<typeof deriveF2508Fields>;
}) {
  return (
    <div className="border-b last:border-b-0">
      <p className="bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide">
        {label}
      </p>
      <ul className="divide-y">
        {fields.map((f) => (
          <li
            key={f.key}
            className="grid grid-cols-[1fr_2fr] gap-3 px-4 py-2.5 text-sm"
          >
            <span className="text-xs text-muted-foreground">{f.label}</span>
            <span className="font-medium">{f.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
