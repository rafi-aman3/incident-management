"use client";

import { useActionState } from "react";
import { computeSeverity, SEVERITY_LABELS, type MatrixCoord } from "@/lib/workflow/severity";
import { computeTrack, type IncidentType, type Treatment } from "@/lib/workflow/routing";
import { INCIDENT_TYPE_META } from "@/lib/incidents/types";
import { submitIncident } from "@/app/(app)/incidents/new/[step]/actions";
import type { ActionResult } from "@/lib/incidents/schemas";
import { SandboxBanner } from "./wizard-progress";

type Props = {
  incidentId: string;
  type: IncidentType;
  title: string;
  occurredAt: string;
  area: string | null;
  location: string | null;
  description: string | null;
  isSandbox: boolean;
  likelihood: MatrixCoord;
  consequence: MatrixCoord;
  // injury aggregates for routing preview
  worstTreatment: Treatment | null;
  anyFatality: boolean;
  anyHospitalization: boolean;
  injuredCount: number;
  witnessCount: number;
};

export function Step3Review(props: Props) {
  const {
    incidentId,
    type,
    title,
    occurredAt,
    area,
    location,
    description,
    isSandbox,
    likelihood,
    consequence,
    worstTreatment,
    anyFatality,
    anyHospitalization,
    injuredCount,
    witnessCount,
  } = props;

  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    submitIncident,
    null
  );

  const severity = computeSeverity({ likelihood, consequence });
  const { track, reason } = computeTrack({
    severity,
    type,
    worstTreatment,
    anyFatality,
    anyHospitalization,
  });

  const TypeIcon = INCIDENT_TYPE_META[type].icon;

  return (
    <form action={formAction} className="space-y-6">
      {isSandbox && <SandboxBanner />}

      <input type="hidden" name="incident_id" value={incidentId} />
      <input type="hidden" name="likelihood" value={likelihood} />
      <input type="hidden" name="consequence" value={consequence} />

      <section className="rounded-md border p-4">
        <div className="flex items-start gap-3">
          <TypeIcon className="mt-1 h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {INCIDENT_TYPE_META[type].label}
            </div>
            <div className="text-lg font-semibold">{title}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {new Date(occurredAt).toLocaleString()} · {area ?? "—"}
              {location ? ` / ${location}` : ""}
            </div>
            {description && <p className="mt-3 text-sm">{description}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-md border p-4">
        <h2 className="mb-3 text-base font-semibold">What the system will do</h2>
        <dl className="space-y-2 text-sm">
          <Row label="Severity" value={`${severity} — ${SEVERITY_LABELS[severity]}`} />
          <Row label="Track" value={`${track} — ${reason}`} />
          <Row
            label="Investigation"
            value={
              isSandbox
                ? "skipped (sandbox)"
                : track === "A" || track === "B"
                ? `auto-create — due in ${track === "A" ? "14" : "7"} days`
                : "none (Track C — log and close)"
            }
          />
          <Row
            label="Notifications"
            value={
              isSandbox
                ? "skipped (sandbox)"
                : "fired immediately for any applicable regulatory clocks"
            }
          />
          <Row
            label="People involved"
            value={`${injuredCount} affected · ${witnessCount} witness${witnessCount === 1 ? "" : "es"}`}
          />
        </dl>
      </section>

      {state?.ok === false && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex items-center justify-between border-t pt-4">
        <a
          href={`/incidents/new/2?id=${incidentId}`}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Back
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Submit incident"}
        </button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
