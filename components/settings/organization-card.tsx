"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOrg } from "@/app/(app)/settings/actions";
import { OrgLogoUploader } from "./org-logo-uploader";
import type { ActionResult } from "@/lib/incidents/schemas";

type IndustryKey =
  | "healthcare"
  | "education"
  | "manufacturing"
  | "warehouse"
  | "office"
  | "construction"
  | "lab";

const INDUSTRY_OPTIONS: ReadonlyArray<{ value: IndustryKey; label: string }> = [
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "warehouse", label: "Warehouse / Logistics" },
  { value: "office", label: "Office" },
  { value: "construction", label: "Construction" },
  { value: "lab", label: "Laboratory" },
];

export function OrganizationCard({
  initial,
}: {
  initial: {
    name: string;
    industry: IndustryKey;
    slug: string;
    logo_url: string | null;
    logo_public_url: string | null;
  };
}) {
  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(updateOrg, null);
  const [industry, setIndustry] = useState<IndustryKey>(initial.industry);

  useEffect(() => {
    if (state?.ok) toast.success("Organisation updated");
    if (state && state.ok === false && !state.fieldErrors)
      toast.error(state.error);
  }, [state]);

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <section
      aria-labelledby="settings-org-heading"
      className="space-y-5 rounded-lg border bg-card p-5"
    >
      <div>
        <h2 id="settings-org-heading" className="text-base font-semibold">
          Organisation
        </h2>
        <p className="text-xs text-muted-foreground">
          How your workspace appears on PDFs, reports, and to teammates.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Logo</Label>
        <OrgLogoUploader
          logoUrl={initial.logo_url}
          publicUrl={initial.logo_public_url}
        />
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="org_name" className="text-xs">
            Name
          </Label>
          <Input
            id="org_name"
            name="name"
            defaultValue={initial.name}
            required
            maxLength={120}
            aria-invalid={!!fieldErr("name")}
          />
          {fieldErr("name") && (
            <p className="text-xs text-destructive">{fieldErr("name")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="org_industry" className="text-xs">
            Industry
          </Label>
          {/* Hidden mirror so the Server Action gets the value when the
              Radix Select changes. */}
          <input type="hidden" name="industry" value={industry} />
          <Select
            value={industry}
            onValueChange={(v) => setIndustry(v as IndustryKey)}
          >
            <SelectTrigger id="org_industry" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErr("industry") && (
            <p className="text-xs text-destructive">{fieldErr("industry")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="org_slug" className="text-xs">
            Workspace ID
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="org_slug"
              value={initial.slug}
              disabled
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy workspace ID"
              onClick={() => {
                navigator.clipboard.writeText(initial.slug);
                toast.success("Copied to clipboard");
              }}
              className="shrink-0"
            >
              <Copy className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Workspace ID is fixed. Contact support if you need to rename.
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </section>
  );
}
