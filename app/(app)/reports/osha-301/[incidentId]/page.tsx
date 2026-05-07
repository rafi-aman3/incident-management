import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, ExternalLink } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import {
  deriveOsha301Fields,
  OSHA_301_FIELD_GROUPS,
  type Osha301Source,
} from "@/lib/format/osha301";
import { PrintButton } from "@/components/reports/print-button";
import { PdfErrorBanner } from "@/components/reports/pdf-error-banner";

type Params = Promise<{ incidentId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Osha301Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { incidentId } = await params;
  const sp = await searchParams;
  const pdfErrorCode =
    typeof sp.pdf_error === "string" ? sp.pdf_error : null;
  const { supabase } = await requireUser();

  // Fetch the incident first (RLS scopes to sites the user can access),
  // then key the perm guard off the incident's own site_id — not the user's
  // currentSiteId cookie. Multi-site users with cookie on the "wrong" site
  // would otherwise 404 here.
  const { data: incident, error } = await supabase
    .from("incidents")
    .select(
      `id, site_id, ref_code, occurred_at, area, location, description, osha_recordable, is_sandbox,
       site:site_id ( name, address ),
       reporter:reporter_id ( full_name, email ),
       injured_persons (
         name, job_title, department, body_parts, injury_nature, object_substance,
         treatment, days_away, days_restricted, fatality, date_of_death
       )`
    )
    .eq("id", incidentId)
    .is("deleted_at", null)
    .single();

  if (error || !incident || !incident.site) notFound();

  const canRead = await can("incident:read_site", incident.site_id);
  const canExport = await can("report:export", incident.site_id);
  if (!canRead) notFound();
  if (!incident.osha_recordable) {
    return (
      <div className="space-y-4">
        <Link
          href={`/incidents/${incident.id}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Back to incident
        </Link>
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          This incident is not OSHA-recordable. Form 301 is only required for
          recordable cases.
        </div>
      </div>
    );
  }

  // Multiple injured_persons rows → render one 301 per person. For v1 we
  // render the first; the rest get a footer note. Real implementations
  // file one 301 per injured employee.
  const ip = (incident.injured_persons ?? [])[0];
  const extraCount = (incident.injured_persons ?? []).length - 1;

  const source: Osha301Source = {
    incident: {
      ref_code: incident.ref_code,
      occurred_at: incident.occurred_at,
      area: incident.area,
      location: incident.location,
      description: incident.description,
    },
    site: incident.site,
    injured: {
      name: ip?.name ?? null,
      job_title: ip?.job_title ?? null,
      department: ip?.department ?? null,
      body_parts: ip?.body_parts ?? null,
      injury_nature: ip?.injury_nature ?? null,
      object_substance: ip?.object_substance ?? null,
      treatment: ip?.treatment ?? null,
      days_away: ip?.days_away ?? null,
      days_restricted: ip?.days_restricted ?? null,
      fatality: ip?.fatality ?? false,
      date_of_death: ip?.date_of_death ?? null,
    },
    reporter: incident.reporter ?? null,
  };

  const fields = deriveOsha301Fields(source);

  // 7-day deadline countdown
  const occurred = new Date(incident.occurred_at);
  const due = new Date(occurred.getTime() + 7 * 24 * 60 * 60 * 1000);
  const daysLeft = differenceInCalendarDays(due, new Date());
  const overdue = daysLeft < 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Reports
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">OSHA 301 — Incident Report</h1>
          <p className="text-sm text-muted-foreground">
            One Form 301 per injured employee, completed within 7 calendar days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          {canExport && (
            <a
              href={`/api/reports/301/${incident.id}/pdf`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <FileDown className="h-3 w-3" /> Generate PDF
            </a>
          )}
        </div>
      </div>

      <PdfErrorBanner code={pdfErrorCode} />

      <div
        role="status"
        className={`rounded-md border-l-4 p-3 text-sm ${
          overdue
            ? "border-destructive bg-destructive/5"
            : daysLeft <= 1
              ? "border-warning bg-warning/5"
              : "border-muted bg-muted/20"
        }`}
      >
        <p className="font-medium">
          {overdue
            ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"}`
            : daysLeft === 0
              ? "Due today"
              : `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Per OSHA §1904.29(b)(3), Form 301 must be completed within 7 calendar
          days of receiving information about a recordable injury or illness.
        </p>
      </div>

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
        {OSHA_301_FIELD_GROUPS.map((group) => (
          <FieldGroup
            key={group.key}
            label={group.label}
            fields={fields.filter((f) => f.group === group.key)}
          />
        ))}
      </div>

      {extraCount > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
          This incident has {extraCount} additional injured person
          {extraCount === 1 ? "" : "s"}. Real OSHA filings require one 301 per
          person — v1 demo renders the primary record only.
        </div>
      )}

      <div className="text-xs text-muted-foreground print:hidden">
        Edit underlying data on{" "}
        <Link
          href={`/incidents/${incident.id}`}
          className="inline-flex items-center gap-0.5 text-primary hover:underline"
        >
          the incident detail page <ExternalLink className="h-3 w-3" />
        </Link>{" "}
        — changes flow back into this form on next render.
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  fields,
}: {
  label: string;
  fields: ReturnType<typeof deriveOsha301Fields>;
}) {
  return (
    <div className="border-b last:border-b-0">
      <h2 className="bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide">
        {label}
      </h2>
      <ul className="divide-y">
        {fields.map((f) => (
          <li key={f.key} className="grid grid-cols-[40px_1fr_2fr] gap-3 px-4 py-2.5 text-sm">
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {String(f.num).padStart(2, "0")}
            </span>
            <span className="text-xs text-muted-foreground">{f.label}</span>
            <span className="font-medium">{f.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
