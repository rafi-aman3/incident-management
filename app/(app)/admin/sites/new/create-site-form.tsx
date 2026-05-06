"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSite, type CreateSiteState } from "./actions";

// Sentinel for the parent-site Select; Radix forbids an empty-string
// SelectItem (it uses "" to represent the placeholder state). Hidden
// input reduces this back to "" before the form submits.
const NO_PARENT = "__none__";

const TIMEZONE_HINTS = [
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "UTC", label: "UTC" },
];

export type ParentChoice = { id: string; name: string; country: "US" | "GB" };

export function CreateSiteForm({
  parentChoices,
  cancelHref,
}: {
  parentChoices: ParentChoice[];
  cancelHref: string;
}) {
  const [state, formAction, isPending] = useActionState<CreateSiteState, FormData>(
    createSite,
    null,
  );
  const [country, setCountry] = useState<"US" | "GB">("US");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [parentId, setParentId] = useState<string>("");

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Site name</Label>
        <Input id="name" name="name" required autoFocus placeholder="e.g. Houston Plant" />
        <FieldError msg={fieldErr("name")} />
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
            Drives the site-local midnight that overdue checks run at.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address (optional)</Label>
        <Textarea id="address" name="address" rows={2} placeholder="Street, city, postal code" />
        <FieldError msg={fieldErr("address")} />
      </div>

      {country === "US" && (
        <div className="space-y-2">
          <Label htmlFor="naics_code">NAICS code (optional)</Label>
          <Input
            id="naics_code"
            name="naics_code"
            inputMode="numeric"
            pattern="\d{6}"
            placeholder="6 digits — e.g. 332710"
          />
          <FieldError msg={fieldErr("naics_code")} />
          <p className="text-xs text-muted-foreground">
            Used on OSHA 300A. You can fill this in later from the Site Setup wizard.
          </p>
        </div>
      )}

      {parentChoices.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="parent_site_id">Parent site (optional)</Label>
          <Select value={parentId || NO_PARENT} onValueChange={setParentId}>
            <SelectTrigger id="parent_site_id" className="w-full">
              <SelectValue placeholder="No parent — top-level site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PARENT}>No parent — top-level site</SelectItem>
              {parentChoices.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {s.country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="hidden"
            name="parent_site_id"
            value={parentId === NO_PARENT ? "" : parentId}
          />
          <FieldError msg={fieldErr("parent_site_id")} />
          <p className="text-xs text-muted-foreground">
            Pick a parent for hierarchy roll-ups. Members with{" "}
            <span className="font-medium">include children</span> on the parent will see this site too.
          </p>
        </div>
      )}

      {state?.ok === false && state.error !== "Validation failed" && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-5">
        <Link
          href={cancelHref}
          className="text-sm text-muted-foreground hover:underline"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={isPending} className="gap-1.5">
          <Building2 className="h-4 w-4" />
          {isPending ? "Creating…" : "Create site"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
