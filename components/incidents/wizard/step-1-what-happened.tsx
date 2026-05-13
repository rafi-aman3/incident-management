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
          {INCIDENT_TYPES.map((t, i) => {
            const meta = INCIDENT_TYPE_META[t];
            const Icon = meta.icon;
            const selected = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={selected}
                style={{ ["--d" as string]: `${240 + i * 50}ms` }}
                className={cn(
                  "dashboard-enter group relative flex flex-col items-start gap-1.5 overflow-hidden rounded-md border p-3 text-left text-sm transition-all duration-300",
                  "hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0",
                  selected
                    ? "border-primary/60 bg-gradient-to-br from-primary/15 via-primary/5 to-card ring-1 ring-primary/40"
                    : "border-border hover:border-primary/30 hover:bg-accent",
                )}
              >
                {/* selected glow */}
                {selected && (
                  <span
                    className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl"
                    aria-hidden
                  />
                )}
                {/* hover top rail (unselected only) */}
                {!selected && (
                  <span
                    className="pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary via-accent-cyan to-primary transition-transform duration-300 group-hover:scale-x-100"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-md transition-all duration-300",
                    selected
                      ? "bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30"
                      : "bg-muted/60 group-hover:bg-primary/10",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors duration-300",
                      selected ? "text-primary" : "text-muted-foreground group-hover:text-primary",
                    )}
                  />
                </span>
                <div className={cn("font-medium transition-colors", selected && "text-primary")}>
                  {meta.label}
                </div>
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
          className="group relative inline-flex items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-primary via-primary to-[var(--brand-hover)] px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm motion-reduce:hover:translate-y-0"
        >
          <span
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden"
            aria-hidden
          />
          <span className="relative">{isPending ? "Saving…" : "Continue to Step 2"}</span>
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
