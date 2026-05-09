"use client";

import { useActionState, useState } from "react";
import { Label } from "@/components/ui/label";
import { saveStep5 } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import {
  APPLICABLE_STANDARD_CODES,
  APPLICABLE_STANDARD_LABELS,
  type ApplicableStandardCode,
} from "@/lib/site-setup/applicable-standards";
import {
  HAZARD_TAG_CODES,
  HAZARD_TAG_LABELS,
  HAZARD_TAG_DESCRIPTIONS,
  type HazardTagCode,
} from "@/lib/site-setup/hazard-tags";
import { FieldError, StepFooter, StepFormError } from "./wizard-chrome";

type Initial = {
  country: "US" | "GB";
  applicable_standards: ApplicableStandardCode[];
  psm_applicable: boolean;
  hazard_tags: HazardTagCode[];
};

export function Step5Hazards({ initial }: { initial: Initial }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep5,
    null
  );
  const [standards, setStandards] = useState<Set<ApplicableStandardCode>>(
    () => new Set(initial.applicable_standards)
  );
  const [tags, setTags] = useState<Set<HazardTagCode>>(() => new Set(initial.hazard_tags));

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  const toggleStandard = (code: ApplicableStandardCode) => {
    setStandards((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleTag = (code: HazardTagCode) => {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="country" value={initial.country} />

      {initial.country === "US" && (
        <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
          <legend className="px-1 text-sm font-semibold">Applicable OSHA standards</legend>

          <p className="text-xs text-muted-foreground">
            Which 29 CFR Part(s) apply to this site. Most sites pick exactly one. Mixed sites —
            a manufacturing campus with active construction — pick more than one.
          </p>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {APPLICABLE_STANDARD_CODES.map((code) => (
              <label
                key={code}
                className="flex items-center gap-3 rounded-md border bg-background p-3 text-sm hover:bg-accent/50"
              >
                <input
                  type="checkbox"
                  name="applicable_standards"
                  value={code}
                  checked={standards.has(code)}
                  onChange={() => toggleStandard(code)}
                  className="h-4 w-4"
                />
                <span>{APPLICABLE_STANDARD_LABELS[code]}</span>
              </label>
            ))}
          </div>
          <FieldError msg={fieldErr("applicable_standards")} />

          <label className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm">
            <input
              type="checkbox"
              name="psm_applicable"
              defaultChecked={initial.psm_applicable}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="block font-medium">Process Safety Management applies</span>
              <span className="block text-xs text-muted-foreground">
                29 CFR 1910.119 — for sites handling highly hazardous chemicals above threshold
                quantities (refining, large chemical processing, etc.).
              </span>
            </span>
          </label>
          <FieldError msg={fieldErr("psm_applicable")} />
        </fieldset>
      )}

      <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
        <legend className="px-1 text-sm font-semibold">Hazard profile</legend>

        <p className="text-xs text-muted-foreground">
          Which hazards are present at this site. Drives downstream program/training requirements
          and which RegTooltips show on incident forms.
        </p>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {HAZARD_TAG_CODES.map((code) => (
            <label
              key={code}
              className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm hover:bg-accent/50"
            >
              <input
                type="checkbox"
                name="hazard_tags"
                value={code}
                checked={tags.has(code)}
                onChange={() => toggleTag(code)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block font-medium">{HAZARD_TAG_LABELS[code]}</span>
                <span className="block text-xs text-muted-foreground">
                  {HAZARD_TAG_DESCRIPTIONS[code]}
                </span>
              </span>
            </label>
          ))}
        </div>
        <FieldError msg={fieldErr("hazard_tags")} />
      </fieldset>

      <StepFormError
        message={state?.ok === false ? state.error : undefined}
        isPending={isPending}
      />

      <StepFooter
        prevHref="/admin/site-setup/workforce"
        isPending={isPending}
      />
    </form>
  );
}
