"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { INCIDENT_TYPES, INCIDENT_TYPE_META, type IncidentType } from "@/lib/incidents/types";
import type { ActionResult } from "@/lib/incidents/schemas";
import { saveStep1 } from "@/app/(app)/incidents/new/[step]/actions";
import { SandboxBanner } from "./wizard-progress";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/info-tooltip";

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/** Convert an ISO string from the server to the `datetime-local` format
 *  the input expects (YYYY-MM-DDTHH:mm in local time). */
function isoToLocal(iso: string | null): string {
  if (!iso) return nowLocal();
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export interface Step1Initial {
  type: IncidentType | null;
  title: string;
  description: string;
  occurred_at: string | null;
  area: string;
  location: string;
  is_sandbox: boolean;
}

export function Step1WhatHappened({
  incidentId,
  initialSandbox = false,
  initial,
}: {
  incidentId: string;
  initialSandbox?: boolean;
  initial: Step1Initial;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep1,
    null,
  );
  const [type, setType] = useState<IncidentType | null>(initial.type);
  const [sandbox, setSandbox] = useState(initial.is_sandbox || initialSandbox);

  const fieldErr = (k: string) => state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <TooltipProvider>
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="incident_id" value={incidentId} />
      {sandbox && <SandboxBanner />}

      <div className="space-y-2">
        <Label className="flex items-center">
          What kind of event are you reporting?
          <InfoTooltip tip="dangerous_occurrence" />
        </Label>
        <p className="text-xs text-muted-foreground">Pick one — you can add more detail in the next step.</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {INCIDENT_TYPES.map((t) => {
            const meta = INCIDENT_TYPE_META[t];
            const Icon = meta.icon;
            const selected = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-md border p-3 text-left text-sm transition-colors",
                  selected ? "border-primary bg-accent" : "hover:bg-accent"
                )}
              >
                <Icon className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
                <div className="font-medium">{meta.label}</div>
                <div className="text-xs leading-snug text-muted-foreground">{meta.description}</div>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="type" value={type ?? ""} />
        <FieldError msg={fieldErr("type")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Short title</Label>
        <Input
          id="title"
          name="title"
          maxLength={200}
          placeholder="e.g. Hand laceration on press 7"
          defaultValue={initial.title}
          required
        />
        <FieldError msg={fieldErr("title")} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="occurred_at">When did it happen?</Label>
          <Input
            id="occurred_at"
            name="occurred_at"
            type="datetime-local"
            defaultValue={isoToLocal(initial.occurred_at)}
            required
          />
          <FieldError msg={fieldErr("occurred_at")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="area">Area</Label>
          <Input id="area" name="area" placeholder="e.g. Production" defaultValue={initial.area} />
          <FieldError msg={fieldErr("area")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Specific location (optional)</Label>
        <Input
          id="location"
          name="location"
          placeholder="e.g. Press 7, Line B"
          defaultValue={initial.location}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">What happened, in your own words</Label>
        <Textarea
          id="description"
          name="description"
          rows={5}
          maxLength={5000}
          placeholder="Describe what you saw, did, or experienced."
          defaultValue={initial.description}
        />
        <p className="text-xs text-muted-foreground">No blame, no judgment — just the facts. Stays confidential.</p>
      </div>

      <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm">
        <Checkbox
          name="is_sandbox"
          checked={sandbox}
          onCheckedChange={(c) => setSandbox(Boolean(c))}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">Practice mode (sandbox)</span>
          <span className="ml-2 text-muted-foreground">
            — Submit a real-feeling report without affecting KPIs or firing notifications.
          </span>
        </span>
      </label>

      {state?.ok === false && state.error !== "Validation failed" && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex items-center justify-between border-t pt-4">
        <a href="/incidents" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending || !type}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Continue to Step 2"}
        </button>
      </div>
    </form>
    </TooltipProvider>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
