"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
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
import { updateSite } from "@/app/(app)/admin/sites/[id]/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

const NO_PARENT = "__none__";

const TIMEZONE_HINTS = [
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Denver", label: "America/Denver" },
  { value: "America/Phoenix", label: "America/Phoenix" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "UTC", label: "UTC" },
];

export type SiteEditable = {
  id: string;
  name: string;
  country: "US" | "GB" | string;
  address: string | null;
  region: string | null;
  timezone: string;
  osha_establishment_id: string | null;
  naics_code: string | null;
  parent_site_id: string | null;
};

export type ParentChoice = {
  id: string;
  name: string;
  country: "US" | "GB" | string;
};

export function EditSiteForm({
  site,
  parentChoices,
  readOnly,
}: {
  site: SiteEditable;
  parentChoices: ParentChoice[];
  readOnly: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    updateSite,
    null,
  );
  const [timezone, setTimezone] = useState(site.timezone);
  // Sentinel KEEP_PARENT means "don't change parent"; otherwise the value is
  // the actual parent_site_id or NO_PARENT.
  const [parentChoice, setParentChoice] = useState<string>(
    site.parent_site_id ?? NO_PARENT,
  );

  useEffect(() => {
    if (state?.ok) toast.success("Site updated");
    if (state && state.ok === false && !state.fieldErrors) toast.error(state.error);
  }, [state]);

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  // US-specific fields hidden for GB sites.
  const isUS = site.country === "US";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="site_id" value={site.id} />

      <div className="space-y-2">
        <Label htmlFor="name">Site name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={site.name}
          required
          maxLength={120}
          disabled={readOnly}
        />
        <FieldError msg={fieldErr("name")} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Country</Label>
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            {site.country === "US" ? "United States (OSHA)" : "United Kingdom (HSE / RIDDOR)"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Country is set at site creation and locks the regulatory engine. To change
            country, archive this site and create a new one.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Time zone</Label>
          <Select
            value={timezone}
            onValueChange={setTimezone}
            disabled={readOnly}
          >
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_HINTS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
              {!TIMEZONE_HINTS.some((tz) => tz.value === site.timezone) && (
                <SelectItem value={site.timezone}>{site.timezone}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <input type="hidden" name="timezone" value={timezone} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address (optional)</Label>
        <Textarea
          id="address"
          name="address"
          defaultValue={site.address ?? ""}
          maxLength={500}
          rows={2}
          disabled={readOnly}
        />
        <FieldError msg={fieldErr("address")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="region">Region (optional)</Label>
        <Input
          id="region"
          name="region"
          defaultValue={site.region ?? ""}
          maxLength={120}
          placeholder={isUS ? "e.g. Texas" : "e.g. Greater Manchester"}
          disabled={readOnly}
        />
        <FieldError msg={fieldErr("region")} />
      </div>

      {isUS && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="osha_establishment_id">OSHA establishment ID (optional)</Label>
            <Input
              id="osha_establishment_id"
              name="osha_establishment_id"
              defaultValue={site.osha_establishment_id ?? ""}
              maxLength={40}
              placeholder="From OSHA's establishment-search tool"
              disabled={readOnly}
            />
            <FieldError msg={fieldErr("osha_establishment_id")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="naics_code">NAICS code (6 digits, optional)</Label>
            <Input
              id="naics_code"
              name="naics_code"
              defaultValue={site.naics_code ?? ""}
              maxLength={6}
              inputMode="numeric"
              pattern="\d{6}"
              placeholder="e.g. 311930"
              disabled={readOnly}
            />
            <FieldError msg={fieldErr("naics_code")} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="parent_site_id">Parent site</Label>
        <Select
          value={parentChoice}
          onValueChange={setParentChoice}
          disabled={readOnly}
        >
          <SelectTrigger id="parent_site_id" className="w-full">
            <SelectValue placeholder="Pick a parent or no parent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PARENT}>No parent (top-level site)</SelectItem>
            {parentChoices
              .filter((p) => p.id !== site.id)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.country})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="parent_site_id" value={parentChoice} />
        <p className="text-[11px] text-muted-foreground">
          Re-parenting changes inheritance. Cycles are rejected server-side.
        </p>
        <FieldError msg={fieldErr("parent_site_id")} />
      </div>

      {state?.ok === false && !state.fieldErrors && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={readOnly || isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        <Link
          href="/admin/sites"
          className="rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
