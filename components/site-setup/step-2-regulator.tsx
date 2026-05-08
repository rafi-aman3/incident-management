"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { saveStep2 } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import { StepFooter, StepFormError } from "./wizard-chrome";

type Props = {
  country: "US" | "GB";
  initialRegulator: "osha" | "hse" | "both";
};

export function Step2Regulator({ country, initialRegulator }: Props) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep2,
    null
  );

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Picks which regulatory reports show on this site&apos;s Reports page and which clocks the
        notification engine fires when an incident is classified. Default is taken from the
        country you set in Step 1 ({country === "US" ? "United States → OSHA" : "United Kingdom → HSE / RIDDOR"}).
      </p>

      <RadioGroup name="regulator" defaultValue={initialRegulator} className="space-y-3">
        <RegOption value="osha" title="OSHA only (US)" body="OSHA 300 / 300A / 301 reports + 8h-fatality / 24h-amputation clocks." />
        <RegOption value="hse"  title="HSE / RIDDOR only (UK)" body="RIDDOR F2508 reports + immediate / 7-day / disease clocks." />
        <RegOption value="both" title="Both (rare — multi-jurisdiction site)" body="Show every report and fire every applicable clock." />
      </RadioGroup>

      <StepFormError
        message={state?.ok === false ? state.error : undefined}
        isPending={isPending}
      />

      <StepFooter prevHref="/admin/site-setup/1" isPending={isPending} />
    </form>
  );
}

function RegOption({ value, title, body }: { value: string; title: string; body: string }) {
  return (
    <Label
      htmlFor={`reg-${value}`}
      className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent"
    >
      <RadioGroupItem id={`reg-${value}`} value={value} className="mt-0.5" />
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{body}</div>
      </div>
    </Label>
  );
}
