"use client";

import { useActionState, useEffect } from "react";
import { Check, Info, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStep4 } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import {
  clearPriorStepDraft,
  draftKey,
  pickFromDraft,
  useDraftPersistence,
  describeRestoredAt,
} from "@/lib/site-setup/use-draft-persistence";
import { DraftRestoredBanner, FieldError, StepFooter, StepFormError } from "./wizard-chrome";

type Initial = {
  peak_employees_year: number | null;
  avg_employees_year: number | null;
  partially_exempt_override: boolean;
  // Computed at the server (calls is_ita_required + is_partially_exempt SQL fns).
  computed_partially_exempt: boolean;
  computed_ita_required: boolean;
  // For the inline annual-hours block.
  current_year: number;
  current_year_hours: number | null;
};

export function Step4Workforce({ initial, siteId }: { initial: Initial; siteId: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep4,
    null
  );

  const { formRef, draft, restoredAt, clearAndReload } = useDraftPersistence(
    draftKey(siteId, "workforce")
  );
  useEffect(() => clearPriorStepDraft(siteId, "workforce"), [siteId]);

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  const peakDraftDefault = pickFromDraft(
    draft,
    "peak_employees_year",
    initial.peak_employees_year !== null ? String(initial.peak_employees_year) : ""
  );
  const avgDraftDefault = pickFromDraft(
    draft,
    "avg_employees_year",
    initial.avg_employees_year !== null ? String(initial.avg_employees_year) : ""
  );
  const overrideDraftDefault = draft
    ? draft.partially_exempt_override === "on"
    : initial.partially_exempt_override;

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {restoredAt && (
        <DraftRestoredBanner
          restoredAtLabel={describeRestoredAt(restoredAt)}
          onDiscard={clearAndReload}
        />
      )}
      <p className="text-sm text-muted-foreground">
        Employee headcount and annual hours drive Form 300A annual summary, recordkeeping
        exemption, and incident-rate metrics (TRIR / DART).
      </p>

      <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
        <legend className="px-1 text-sm font-semibold">Headcount this calendar year</legend>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="peak_employees_year">Peak employees</Label>
            <Input
              id="peak_employees_year"
              name="peak_employees_year"
              type="number"
              min={0}
              max={1000000}
              defaultValue={peakDraftDefault}
              placeholder="145"
            />
            <FieldError msg={fieldErr("peak_employees_year")} />
            <p className="text-xs text-muted-foreground">
              Maximum employee count at any point during the calendar year. Drives the size-based
              partial-exemption rule (≤10 employees at all times).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="avg_employees_year">Average employees</Label>
            <Input
              id="avg_employees_year"
              name="avg_employees_year"
              type="number"
              min={0}
              max={1000000}
              defaultValue={avgDraftDefault}
              placeholder="132"
            />
            <FieldError msg={fieldErr("avg_employees_year")} />
            <p className="text-xs text-muted-foreground">
              Required on OSHA Form 300A annual summary.
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-md border bg-muted/20 p-4">
        <legend className="px-1 text-sm font-semibold">Annual hours worked ({initial.current_year})</legend>

        <p className="text-xs text-muted-foreground">
          Total hours worked by all employees during the year. Required on Form 300A and used as
          the TRIR / DART denominator. Edit on the dedicated{" "}
          <a
            href="/admin/sites"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Annual hours
          </a>{" "}
          page after launch — multi-year history lives there.
        </p>

        <div className="rounded-md border bg-background px-3 py-2 text-sm">
          {initial.current_year_hours !== null
            ? `${initial.current_year_hours.toLocaleString()} hours recorded for ${initial.current_year}`
            : `Not yet set for ${initial.current_year}.`}
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
        <legend className="px-1 text-sm font-semibold">Recordkeeping status (computed)</legend>

        <p className="text-xs text-muted-foreground">
          Derived from NAICS + headcount per 29 CFR 1904. Update NAICS or headcount above to see
          the flags change.
        </p>

        <div className="space-y-2">
          <ComputedBadge
            label="Partially exempt from routine recordkeeping (1904.2)"
            value={initial.computed_partially_exempt}
            help={
              initial.computed_partially_exempt
                ? "Either ≤10 employees at all times, or NAICS in the partially-exempt low-hazard list."
                : "Sized above the exemption floor, and NAICS not in the partially-exempt list."
            }
          />
          <ComputedBadge
            label="Required to submit Form 300A via ITA (1904.41)"
            value={initial.computed_ita_required}
            help={
              initial.computed_ita_required
                ? "250+ employees in any covered industry, or 20–249 in a high-hazard NAICS."
                : "Below the size threshold, or NAICS not in the high-hazard list, or partially exempt."
            }
          />
        </div>

        <label className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm">
          <input
            type="checkbox"
            name="partially_exempt_override"
            defaultChecked={overrideDraftDefault}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="block font-medium">Voluntary recordkeeping override</span>
            <span className="block text-xs text-muted-foreground">
              Keep 300/300A/301 records anyway, even if the site is partially exempt. OSHA can
              request records from any employer regardless of exemption.
            </span>
          </span>
        </label>
      </fieldset>

      <StepFormError
        message={state?.ok === false ? state.error : undefined}
        isPending={isPending}
      />

      <StepFooter
        prevHref="/admin/site-setup/identifiers"
        isPending={isPending}
      />
    </form>
  );
}

function ComputedBadge({
  label,
  value,
  help,
}: {
  label: string;
  value: boolean;
  help: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm">
      <span
        aria-hidden
        className={
          value
            ? "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white"
            : "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        }
      >
        {value ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span className="flex-1">
        <span className="block font-medium">
          {label} — {value ? "YES" : "NO"}
        </span>
        <span className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>{help}</span>
        </span>
      </span>
    </div>
  );
}
