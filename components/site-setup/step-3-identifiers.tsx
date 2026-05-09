"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStep3 } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import { FieldError, StepFooter, StepFormError } from "./wizard-chrome";

type Initial = {
  country: "US" | "GB";
  // US
  ein: string | null;
  naics_code: string | null;
  sic_code: string | null;
  ita_establishment_id: string | null;
  osha_establishment_id: string | null;
  // GB
  crn: string | null;
  uk_sic_2007: string | null;
  hse_establishment_number: string | null;
};

export function Step3Identifiers({ initial }: { initial: Initial }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep3,
    null
  );

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="country" value={initial.country} />

      <p className="text-sm text-muted-foreground">
        {initial.country === "US"
          ? "Tax + industry + agency identifiers used on Form 300A and the OSHA ITA portal. EIN and NAICS are required to submit; SIC and the ITA establishment ID are optional."
          : "Companies House registration and UK SIC 2007 industry classification — used for HSE attribution and any local-authority filing. The HSE establishment number is assigned when you register with HSE."}
      </p>

      {initial.country === "US" ? (
        <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
          <legend className="px-1 text-sm font-semibold">US identifiers</legend>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ein">Employer Identification Number (EIN)</Label>
              <Input
                id="ein"
                name="ein"
                defaultValue={initial.ein ?? ""}
                placeholder="12-3456789"
                inputMode="numeric"
                maxLength={10}
              />
              <FieldError msg={fieldErr("ein")} />
              <p className="text-xs text-muted-foreground">
                Federal IRS-issued NN-NNNNNNN. Required to submit Form 300A via the OSHA ITA
                portal.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="naics_code">NAICS code</Label>
              <Input
                id="naics_code"
                name="naics_code"
                defaultValue={initial.naics_code ?? ""}
                placeholder="332710"
                inputMode="numeric"
                maxLength={6}
              />
              <FieldError msg={fieldErr("naics_code")} />
              <p className="text-xs text-muted-foreground">
                6-digit NAICS. Drives recordkeeping exemption + Form 300A electronic-submission
                requirement.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sic_code">SIC code (optional)</Label>
              <Input
                id="sic_code"
                name="sic_code"
                defaultValue={initial.sic_code ?? ""}
                placeholder="3441"
                inputMode="numeric"
                maxLength={4}
              />
              <FieldError msg={fieldErr("sic_code")} />
              <p className="text-xs text-muted-foreground">
                Legacy 4-digit code — some insurers and older OSHA references still use SIC.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ita_establishment_id">ITA establishment ID (optional)</Label>
              <Input
                id="ita_establishment_id"
                name="ita_establishment_id"
                defaultValue={initial.ita_establishment_id ?? ""}
                placeholder="Assigned after ITA registration"
              />
              <FieldError msg={fieldErr("ita_establishment_id")} />
              <p className="text-xs text-muted-foreground">
                OSHA assigns this once you register the establishment in the ITA portal.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="osha_establishment_id">OSHA Establishment ID (optional)</Label>
            <Input
              id="osha_establishment_id"
              name="osha_establishment_id"
              defaultValue={initial.osha_establishment_id ?? ""}
              placeholder="8-digit ID"
              inputMode="numeric"
              maxLength={8}
            />
            <FieldError msg={fieldErr("osha_establishment_id")} />
            <p className="text-xs text-muted-foreground">
              Legacy 8-digit OSHA Establishment ID — used by older Form 300A/301 references.
            </p>
          </div>
        </fieldset>
      ) : (
        <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
          <legend className="px-1 text-sm font-semibold">UK identifiers</legend>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="crn">Companies House CRN</Label>
              <Input
                id="crn"
                name="crn"
                defaultValue={initial.crn ?? ""}
                placeholder="01234567"
                maxLength={8}
              />
              <FieldError msg={fieldErr("crn")} />
              <p className="text-xs text-muted-foreground">
                8-character Companies House Registration Number. Optional if not a registered
                company.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="uk_sic_2007">UK SIC 2007</Label>
              <Input
                id="uk_sic_2007"
                name="uk_sic_2007"
                defaultValue={initial.uk_sic_2007 ?? ""}
                placeholder="25620"
                inputMode="numeric"
                maxLength={5}
              />
              <FieldError msg={fieldErr("uk_sic_2007")} />
              <p className="text-xs text-muted-foreground">
                5-digit UK Standard Industrial Classification 2007.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hse_establishment_number">HSE establishment number (optional)</Label>
            <Input
              id="hse_establishment_number"
              name="hse_establishment_number"
              defaultValue={initial.hse_establishment_number ?? ""}
              placeholder="Assigned by HSE on registration"
            />
            <FieldError msg={fieldErr("hse_establishment_number")} />
          </div>
        </fieldset>
      )}

      <StepFormError
        message={state?.ok === false ? state.error : undefined}
        isPending={isPending}
      />

      <StepFooter
        prevHref="/admin/site-setup/jurisdiction"
        isPending={isPending}
      />
    </form>
  );
}
