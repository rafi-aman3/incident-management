"use client";

import { useActionState, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveStep1 } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import {
  clearPriorStepDraft,
  draftKey,
  pickFromDraft,
  useDraftPersistence,
  describeRestoredAt,
} from "@/lib/site-setup/use-draft-persistence";
import { DraftRestoredBanner, FieldError, StepFooter, StepFormError } from "./wizard-chrome";

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
  street_1: string | null;
  street_2: string | null;
  city: string | null;
  state_or_region: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  country: "US" | "GB";
  timezone: string;
  site_type: "fixed" | "mobile" | "office_only";
  operational_status: "active" | "inactive" | "closed";
  opened_on: string | null;
  closed_on: string | null;
};

export function Step1Basics({ initial, siteId }: { initial: Initial; siteId: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep1,
    null
  );

  const { formRef, draft, restoredAt, clearAndReload } = useDraftPersistence(
    draftKey(siteId, "basics")
  );

  // Clear the prior step's draft on mount (no prior step here, so no-op).
  useEffect(() => clearPriorStepDraft(siteId, "basics"), [siteId]);

  const [timezone, setTimezone] = useState(pickFromDraft(draft, "timezone", initial.timezone));
  const [siteType, setSiteType] = useState(
    pickFromDraft(draft, "site_type", initial.site_type) as Initial["site_type"]
  );
  const [opStatus, setOpStatus] = useState(
    pickFromDraft(draft, "operational_status", initial.operational_status) as Initial["operational_status"]
  );

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  const def = (key: string, fallback: string | null): string =>
    pickFromDraft(draft, key, fallback ?? "");

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <input type="hidden" name="country" value={initial.country} />

      {restoredAt && (
        <DraftRestoredBanner
          restoredAtLabel={describeRestoredAt(restoredAt)}
          onDiscard={clearAndReload}
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Establishment name</Label>
        <Input id="name" name="name" defaultValue={def("name", initial.name)} required />
        <FieldError msg={fieldErr("name")} />
        <p className="text-xs text-muted-foreground">
          OSHA defines an "establishment" as a single physical location where business is conducted.
          One company can have many establishments.
        </p>
      </div>

      <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
        <legend className="px-1 text-sm font-semibold">Physical address</legend>

        <div className="space-y-2">
          <Label htmlFor="street_1">Street address</Label>
          <Input
            id="street_1"
            name="street_1"
            defaultValue={def("street_1", initial.street_1)}
            placeholder="123 Industry Way"
          />
          <FieldError msg={fieldErr("street_1")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="street_2">Suite / unit (optional)</Label>
          <Input
            id="street_2"
            name="street_2"
            defaultValue={def("street_2", initial.street_2)}
            placeholder="Suite 400"
          />
          <FieldError msg={fieldErr("street_2")} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={def("city", initial.city)} />
            <FieldError msg={fieldErr("city")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state_or_region">
              {initial.country === "US" ? "State" : "Region / county"}
            </Label>
            <Input
              id="state_or_region"
              name="state_or_region"
              defaultValue={def("state_or_region", initial.state_or_region)}
              placeholder={initial.country === "US" ? "TX" : "Greater Manchester"}
            />
            <FieldError msg={fieldErr("state_or_region")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_code">
              {initial.country === "US" ? "ZIP code" : "Postcode"}
            </Label>
            <Input
              id="postal_code"
              name="postal_code"
              defaultValue={def("postal_code", initial.postal_code)}
              placeholder={initial.country === "US" ? "77002" : "M1 2AB"}
            />
            <FieldError msg={fieldErr("postal_code")} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="latitude">Latitude (optional)</Label>
            <Input
              id="latitude"
              name="latitude"
              type="text"
              inputMode="decimal"
              defaultValue={def(
                "latitude",
                initial.latitude !== null ? String(initial.latitude) : null
              )}
              placeholder="29.7604"
            />
            <FieldError msg={fieldErr("latitude")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longitude">Longitude (optional)</Label>
            <Input
              id="longitude"
              name="longitude"
              type="text"
              inputMode="decimal"
              defaultValue={def(
                "longitude",
                initial.longitude !== null ? String(initial.longitude) : null
              )}
              placeholder="-95.3698"
            />
            <FieldError msg={fieldErr("longitude")} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Right-click in Google Maps → click the coordinate pair → paste here. Both fields must be
          set or both blank. Used by the future site-map dashboard view.
        </p>
      </fieldset>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Country</Label>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            {initial.country === "US"
              ? "United States (OSHA jurisdiction)"
              : "United Kingdom (HSE / RIDDOR)"}
          </div>
          <p className="text-xs text-muted-foreground">
            Country is locked at site creation — change requires a new site.
          </p>
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

      <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
        <legend className="px-1 text-sm font-semibold">Site lifecycle</legend>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="site_type">Site type</Label>
            <Select value={siteType} onValueChange={(v) => setSiteType(v as typeof siteType)}>
              <SelectTrigger id="site_type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed establishment</SelectItem>
                <SelectItem value="mobile">Mobile / temporary worksite</SelectItem>
                <SelectItem value="office_only">Office-only</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="site_type" value={siteType} />
            <FieldError msg={fieldErr("site_type")} />
            <p className="text-xs text-muted-foreground">
              Mobile / temporary worksites use the parent establishment's records for traveling
              crews (oil &amp; gas service, construction).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="operational_status">Status</Label>
            <Select value={opStatus} onValueChange={(v) => setOpStatus(v as typeof opStatus)}>
              <SelectTrigger id="operational_status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="operational_status" value={opStatus} />
            <FieldError msg={fieldErr("operational_status")} />
            <p className="text-xs text-muted-foreground">
              Closed sites stay searchable for OSHA's 5-year retention; new incidents can't be
              filed against them.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="opened_on">Opened on (optional)</Label>
            <Input
              id="opened_on"
              name="opened_on"
              type="date"
              defaultValue={def("opened_on", initial.opened_on)}
            />
            <FieldError msg={fieldErr("opened_on")} />
          </div>
          {opStatus === "closed" && (
            <div className="space-y-2">
              <Label htmlFor="closed_on">Closed on</Label>
              <Input
                id="closed_on"
                name="closed_on"
                type="date"
                defaultValue={def("closed_on", initial.closed_on)}
              />
              <FieldError msg={fieldErr("closed_on")} />
            </div>
          )}
        </div>
      </fieldset>

      <StepFormError
        message={state?.ok === false ? state.error : undefined}
        isPending={isPending}
      />

      <StepFooter prevHref={null} isPending={isPending} />
    </form>
  );
}
