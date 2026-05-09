"use client";

import { useActionState, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveStep2 } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import { STATE_PLANS } from "@/lib/site-setup/state-plans";
import {
  clearPriorStepDraft,
  draftKey,
  pickFromDraft,
  useDraftPersistence,
  describeRestoredAt,
} from "@/lib/site-setup/use-draft-persistence";
import { DraftRestoredBanner, FieldError, StepFooter, StepFormError } from "./wizard-chrome";

type Initial = {
  country: "US" | "GB";
  osha_jurisdiction: "federal" | "state_plan" | null;
  state_plan_code: string | null;
  gb_jurisdiction: "hse" | "local_authority" | null;
};

export function Step2Jurisdiction({ initial, siteId }: { initial: Initial; siteId: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep2,
    null
  );

  const { formRef, draft, restoredAt, clearAndReload } = useDraftPersistence(
    draftKey(siteId, "jurisdiction")
  );
  useEffect(() => clearPriorStepDraft(siteId, "jurisdiction"), [siteId]);

  const [oshaJurisdiction, setOshaJurisdiction] = useState<"federal" | "state_plan">(
    pickFromDraft(draft, "osha_jurisdiction", initial.osha_jurisdiction ?? "federal") as
      | "federal"
      | "state_plan"
  );
  const [statePlanCode, setStatePlanCode] = useState(
    pickFromDraft(draft, "state_plan_code", initial.state_plan_code ?? "")
  );
  const [gbJurisdiction, setGbJurisdiction] = useState<"hse" | "local_authority">(
    pickFromDraft(draft, "gb_jurisdiction", initial.gb_jurisdiction ?? "hse") as
      | "hse"
      | "local_authority"
  );

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <input type="hidden" name="country" value={initial.country} />

      {restoredAt && (
        <DraftRestoredBanner
          restoredAtLabel={describeRestoredAt(restoredAt)}
          onDiscard={clearAndReload}
        />
      )}

      <p className="text-sm text-muted-foreground">
        {initial.country === "US"
          ? "Most US sites report to federal OSHA. 22 states + Puerto Rico + the US Virgin Islands run their own OSHA-approved state plans with their own portals and (sometimes) stricter rules."
          : "RIDDOR enforcement is split between HSE and local authorities. HSE covers high-hazard premises (manufacturing, construction, agriculture); local authorities cover offices, retail, and leisure."}
      </p>

      {initial.country === "US" ? (
        <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
          <legend className="px-1 text-sm font-semibold">OSHA jurisdiction</legend>

          <div className="space-y-2">
            <Label htmlFor="osha_jurisdiction">Reports to</Label>
            <Select
              value={oshaJurisdiction}
              onValueChange={(v) => setOshaJurisdiction(v as typeof oshaJurisdiction)}
            >
              <SelectTrigger id="osha_jurisdiction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="federal">Federal OSHA</SelectItem>
                <SelectItem value="state_plan">A state plan</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="osha_jurisdiction" value={oshaJurisdiction} />
            <FieldError msg={fieldErr("osha_jurisdiction")} />
          </div>

          {oshaJurisdiction === "state_plan" && (
            <div className="space-y-2">
              <Label htmlFor="state_plan_code">Which state plan</Label>
              <Select value={statePlanCode} onValueChange={setStatePlanCode}>
                <SelectTrigger id="state_plan_code" className="w-full">
                  <SelectValue placeholder="— pick a state plan —" />
                </SelectTrigger>
                <SelectContent>
                  {STATE_PLANS.map((sp) => (
                    <SelectItem key={sp.code} value={sp.code}>
                      {sp.name}
                      {sp.scope === "state_local_only" && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (state/local employees only)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="state_plan_code" value={statePlanCode} />
              <FieldError msg={fieldErr("state_plan_code")} />
              <p className="text-xs text-muted-foreground">
                CT, IL, ME, NJ, NY and VI cover state and local government employees only —
                private-sector employees in those jurisdictions still report to federal OSHA.
              </p>
            </div>
          )}
        </fieldset>
      ) : (
        <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
          <legend className="px-1 text-sm font-semibold">RIDDOR enforcement</legend>

          <div className="space-y-2">
            <Label htmlFor="gb_jurisdiction">Enforcing authority</Label>
            <Select
              value={gbJurisdiction}
              onValueChange={(v) => setGbJurisdiction(v as typeof gbJurisdiction)}
            >
              <SelectTrigger id="gb_jurisdiction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hse">HSE (Health and Safety Executive)</SelectItem>
                <SelectItem value="local_authority">Local authority</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="gb_jurisdiction" value={gbJurisdiction} />
            <FieldError msg={fieldErr("gb_jurisdiction")} />
            <p className="text-xs text-muted-foreground">
              HSE for manufacturing, construction, agriculture, and high-hazard premises. Local
              authority (typically environmental health) for offices, retail, leisure, and most
              service-sector sites.
            </p>
          </div>
        </fieldset>
      )}

      <StepFormError
        message={state?.ok === false ? state.error : undefined}
        isPending={isPending}
      />

      <StepFooter
        prevHref="/admin/site-setup/basics"
        isPending={isPending}
      />
    </form>
  );
}
