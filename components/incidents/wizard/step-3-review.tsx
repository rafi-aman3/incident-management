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

      <div className="flex flex-col items-stretch gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 text-sm">
          <a
            href={`/incidents/new/2?id=${incidentId}`}
            className="text-muted-foreground underline-offset-2 hover:underline"
          >
            ← Back
          </a>
          <a
            href="/incidents"
            className="text-muted-foreground underline-offset-2 hover:underline"
          >
            Save draft &amp; exit
          </a>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="submit"
            disabled={isPending}
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-primary via-primary to-[var(--brand-hover)] px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm motion-reduce:hover:translate-y-0"
          >
            <span
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden"
              aria-hidden
            />
            <span className="relative">{isPending ? "Finalizing…" : "Finalize report"}</span>
          </button>
          {!isSandbox && (
            <p className="max-w-xs text-right text-xs text-muted-foreground">
              Starts the regulatory clock and notifies anyone configured for{" "}
              {track === "A"
                ? "Track A"
                : track === "B"
                ? "Track B"
                : "Track C"}{" "}
              events at this site.
            </p>
          )}
        </div>
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
