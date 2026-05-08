"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveStep1 } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import { StepFooter, StepFormError } from "./wizard-chrome";

const TIMEZONE_HINTS = [
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "UTC", label: "UTC" },
];

type Initial = {
  name: string;
  address: string | null;
  country: "US" | "GB";
  timezone: string;
};

export function Step1Basics({ initial }: { initial: Initial }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep1,
    null
  );
  const [country, setCountry] = useState<"US" | "GB">(initial.country);
  const [timezone, setTimezone] = useState(initial.timezone);

  const fieldErr = (k: string) => state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Site name</Label>
        <Input id="name" name="name" defaultValue={initial.name} required />
        <FieldError msg={fieldErr("name")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address (optional)</Label>
        <Textarea id="address" name="address" defaultValue={initial.address ?? ""} rows={3} />
        <FieldError msg={fieldErr("address")} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Select
            value={country}
            onValueChange={(v) => {
              const c = v as "US" | "GB";
              setCountry(c);
              if (c === "US" && !timezone.startsWith("America/")) setTimezone("America/Chicago");
              if (c === "GB") setTimezone("Europe/London");
            }}
          >
            <SelectTrigger id="country" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="US">United States (OSHA jurisdiction)</SelectItem>
              <SelectItem value="GB">United Kingdom (HSE / RIDDOR)</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="country" value={country} />
          <FieldError msg={fieldErr("country")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Time zone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_HINTS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="timezone" value={timezone} />
          <FieldError msg={fieldErr("timezone")} />
          <p className="text-xs text-muted-foreground">
            Drives the site-local midnight that the daily overdue check runs at.
          </p>
        </div>
      </div>

      <StepFormError
        message={state?.ok === false ? state.error : undefined}
        isPending={isPending}
      />

      <StepFooter prevHref={null} isPending={isPending} />
    </form>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
