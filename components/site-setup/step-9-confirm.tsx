"use client";

import { useActionState, useEffect } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { launchSite } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult, NotificationKind } from "@/lib/site-setup/schemas";
import { clearAllDraftsForSite } from "@/lib/site-setup/use-draft-persistence";
import { StepFooter, StepFormError } from "./wizard-chrome";

type Summary = {
  name: string;
  country: "US" | "GB";
  timezone: string;
  // Address
  street_1: string | null;
  city: string | null;
  postal_code: string | null;
  has_lat_long: boolean;
  // Jurisdiction
  osha_jurisdiction: "federal" | "state_plan" | null;
  state_plan_code: string | null;
  gb_jurisdiction: "hse" | "local_authority" | null;
  // Identifiers
  ein: string | null;
  naics_code: string | null;
  crn: string | null;
  uk_sic_2007: string | null;
  // Workforce
  peak_employees_year: number | null;
  avg_employees_year: number | null;
  partially_exempt: boolean;
  ita_required: boolean;
  // Hazards
  applicable_standards_count: number;
  hazard_tags_count: number;
  psm_applicable: boolean;
  // Departments
  departmentCount: number;
  // People
  has_ehs_lead: boolean;
  has_riddor_responsible_person: boolean;
  emergency_contact_count: number;
  // Members
  memberCount: number;
  // Recipients
  recipientKindsConfigured: NotificationKind[];
  warnings: string[];
};

export function Step9Confirm({ summary, siteId }: { summary: Summary; siteId: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async () => launchSite(),
    null
  );

  // Reaching the Confirm step means every prior step is server-persisted.
  // Wipe all of this site's drafts so a future fresh re-walk starts clean.
  useEffect(() => clearAllDraftsForSite(siteId), [siteId]);

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Final review. After you launch, this site is live for incident reporting and the
        regulatory engine will run on every classification.
      </p>

      <Section title="Location">
        <Row label="Site name" value={summary.name} />
        <Row label="Country" value={summary.country === "US" ? "United States" : "United Kingdom"} />
        <Row label="Time zone" value={summary.timezone} />
        <Row
          label="Street address"
          value={summary.street_1 ?? "—"}
          warn={!summary.street_1}
        />
        <Row label="City" value={summary.city ?? "—"} warn={!summary.city} />
        <Row
          label={summary.country === "US" ? "ZIP code" : "Postcode"}
          value={summary.postal_code ?? "—"}
          warn={!summary.postal_code}
        />
        <Row
          label="Map coordinates"
          value={summary.has_lat_long ? "set" : "—"}
        />
      </Section>

      <Section title="Jurisdiction">
        {summary.country === "US" ? (
          <>
            <Row
              label="OSHA jurisdiction"
              value={
                summary.osha_jurisdiction === "federal"
                  ? "Federal OSHA"
                  : summary.osha_jurisdiction === "state_plan"
                    ? `State plan (${summary.state_plan_code ?? "?"})`
                    : "—"
              }
              warn={!summary.osha_jurisdiction}
            />
          </>
        ) : (
          <Row
            label="RIDDOR enforcement"
            value={
              summary.gb_jurisdiction === "hse"
                ? "HSE"
                : summary.gb_jurisdiction === "local_authority"
                  ? "Local authority"
                  : "—"
            }
            warn={!summary.gb_jurisdiction}
          />
        )}
      </Section>

      <Section title="Identifiers">
        {summary.country === "US" ? (
          <>
            <Row label="EIN" value={summary.ein ?? "—"} warn={!summary.ein} />
            <Row label="NAICS" value={summary.naics_code ?? "—"} warn={!summary.naics_code} />
          </>
        ) : (
          <>
            <Row label="Companies House CRN" value={summary.crn ?? "—"} />
            <Row label="UK SIC 2007" value={summary.uk_sic_2007 ?? "—"} warn={!summary.uk_sic_2007} />
          </>
        )}
      </Section>

      <Section title="Workforce">
        <Row
          label="Peak employees this year"
          value={
            summary.peak_employees_year !== null
              ? String(summary.peak_employees_year)
              : "—"
          }
          warn={summary.peak_employees_year === null}
        />
        <Row
          label="Average employees this year"
          value={
            summary.avg_employees_year !== null
              ? String(summary.avg_employees_year)
              : "—"
          }
          warn={summary.avg_employees_year === null}
        />
        <Row
          label="Partially exempt from recordkeeping"
          value={summary.partially_exempt ? "yes" : "no"}
        />
        <Row
          label="Form 300A ITA submission required"
          value={summary.ita_required ? "yes" : "no"}
        />
      </Section>

      <Section title="Hazards">
        {summary.country === "US" && (
          <>
            <Row
              label="Applicable OSHA standards"
              value={`${summary.applicable_standards_count} selected`}
              warn={summary.applicable_standards_count === 0}
            />
            <Row label="PSM applicable" value={summary.psm_applicable ? "yes" : "no"} />
          </>
        )}
        <Row
          label="Hazard tags"
          value={`${summary.hazard_tags_count} selected`}
        />
      </Section>

      <Section title="People + departments">
        <Row label="Departments" value={String(summary.departmentCount)} warn={summary.departmentCount === 0} />
        <Row label="Site EHS lead set" value={summary.has_ehs_lead ? "yes" : "no"} warn={!summary.has_ehs_lead} />
        {summary.country === "GB" && (
          <Row
            label="RIDDOR responsible person"
            value={summary.has_riddor_responsible_person ? "set" : "—"}
            warn={!summary.has_riddor_responsible_person}
          />
        )}
        <Row
          label="Emergency contacts"
          value={String(summary.emergency_contact_count)}
          warn={summary.emergency_contact_count === 0}
        />
        <Row label="Site members" value={String(summary.memberCount)} warn={summary.memberCount === 0} />
        <Row
          label="Notification kinds configured"
          value={`${summary.recipientKindsConfigured.length} of 8`}
        />
      </Section>

      {summary.warnings.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" /> Heads-up before you launch
          </div>
          <ul className="list-disc space-y-0.5 pl-5">
            {summary.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <StepFormError
        message={state?.ok === false ? state.error : undefined}
        isPending={isPending}
      />

      <StepFooter prevHref="/admin/site-setup/recipients" isPending={isPending} primaryLabel="Launch site" />
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1.5 text-sm">{children}</ul>
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={warn ? "flex items-center gap-1 text-amber-700 dark:text-amber-300" : "flex items-center gap-1"}>
        {!warn && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
        {warn && <AlertCircle className="h-3.5 w-3.5" />}
        {value}
      </span>
    </li>
  );
}
