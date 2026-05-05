"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStep3 } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import { StepFooter } from "./wizard-chrome";

type Initial = {
  country: "US" | "GB";
  osha_establishment_id: string | null;
  naics_code: string | null;
  hse_establishment_number: string | null;
};

export function Step3EstablishmentIds({ initial }: { initial: Initial }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep3,
    null
  );
  const [skipped, setSkipped] = useState(false);

  const fieldErr = (k: string) => state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        These IDs are mandatory for valid OSHA 300A / RIDDOR submissions. Skip for now if you don&apos;t
        have them yet — the site will show a warning chip until they&apos;re filled in.
      </p>

      {initial.country === "US" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="osha_establishment_id">OSHA Establishment ID</Label>
            <Input
              id="osha_establishment_id"
              name="osha_establishment_id"
              defaultValue={initial.osha_establishment_id ?? ""}
              placeholder="12345678"
              maxLength={8}
              disabled={skipped}
            />
            <p className="text-xs text-muted-foreground">8 digits. Issued by OSHA.</p>
            <FieldError msg={fieldErr("osha_establishment_id")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="naics_code">NAICS Code</Label>
            <Input
              id="naics_code"
              name="naics_code"
              defaultValue={initial.naics_code ?? ""}
              placeholder="332710"
              maxLength={6}
              disabled={skipped}
            />
            <p className="text-xs text-muted-foreground">
              6 digits.{" "}
              <a
                href="https://www.census.gov/naics/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Look up NAICS
              </a>
              .
            </p>
            <FieldError msg={fieldErr("naics_code")} />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="hse_establishment_number">HSE Establishment Number (optional)</Label>
          <Input
            id="hse_establishment_number"
            name="hse_establishment_number"
            defaultValue={initial.hse_establishment_number ?? ""}
            disabled={skipped}
          />
          <FieldError msg={fieldErr("hse_establishment_number")} />
        </div>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={skipped}
          onChange={(e) => setSkipped(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="font-medium">I&apos;ll fill these in later.</span>{" "}
          <span className="text-muted-foreground">
            Site will show a warning chip on the dashboard until completed.
          </span>
        </span>
      </label>
      <input type="hidden" name="skipped" value={String(skipped)} />

      {state?.ok === false && state.error !== "Validation failed" && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <StepFooter prevHref="/admin/site-setup/2" isPending={isPending} />
    </form>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
