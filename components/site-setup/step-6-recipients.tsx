"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveStep6 } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import { NOTIFICATION_KINDS, type NotificationKind } from "@/lib/site-setup/schemas";
import { StepFooter, StepFormError } from "./wizard-chrome";

export type ProfileChoice = { id: string; full_name: string | null; email: string };
export type RecipientRow = {
  recipient_profile_id?: string;
  external_email?: string;
};
export type RecipientsByKind = Partial<Record<NotificationKind, RecipientRow[]>>;

const KIND_LABELS: Record<NotificationKind, { title: string; body: string; required?: boolean }> = {
  osha_8hr:          { title: "OSHA 8-hour fatality",      body: "Fatality must be reported to OSHA within 8 hours.", required: true },
  osha_24hr:         { title: "OSHA 24-hour amputation",   body: "Amputation, loss of an eye, or in-patient hospitalization within 24 hours." },
  riddor_immediate:  { title: "RIDDOR immediate phone",    body: "Specified injury or fatality — phone HSE before written submission.", required: true },
  riddor_f2508_10d:  { title: "RIDDOR F2508 (10-day)",     body: "Written submission within 10 days of the incident." },
  riddor_7day:       { title: "RIDDOR over-7-day injury",  body: "Worker incapacitated for over 7 days — written submission within 15 days." },
  riddor_disease:    { title: "RIDDOR occupational disease", body: "Diagnosed occupational disease per Schedule 3." },
  capa_overdue:      { title: "CAPA overdue",              body: "A CAPA passed its due date without progress." },
  capa_escalated:    { title: "CAPA escalated",            body: "A CAPA was reopened after a failed verification." },
};

export function Step6Recipients({
  profiles,
  initial,
}: {
  profiles: ProfileChoice[];
  initial: RecipientsByKind;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep6,
    null
  );
  const [byKind, setByKind] = useState<RecipientsByKind>(() => {
    const out: RecipientsByKind = {};
    for (const k of NOTIFICATION_KINDS) out[k] = initial[k] ?? [];
    return out;
  });

  const addRow = (k: NotificationKind) =>
    setByKind((prev) => ({ ...prev, [k]: [...(prev[k] ?? []), {}] }));
  const removeRow = (k: NotificationKind, i: number) =>
    setByKind((prev) => ({ ...prev, [k]: (prev[k] ?? []).filter((_, idx) => idx !== i) }));
  const updateRow = (k: NotificationKind, i: number, patch: Partial<RecipientRow>) =>
    setByKind((prev) => ({
      ...prev,
      [k]: (prev[k] ?? []).map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }));

  const payload = NOTIFICATION_KINDS.map((kind) => ({
    kind,
    list: (byKind[kind] ?? []).filter((r) => r.recipient_profile_id || r.external_email),
  }));

  const missingRequired = NOTIFICATION_KINDS.filter(
    (k) => KIND_LABELS[k].required && (byKind[k] ?? []).filter((r) => r.recipient_profile_id || r.external_email).length === 0
  );

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Pick at least one user (or external email) per high-priority kind. The notification engine
        fires these the moment an incident is classified — without recipients, the regulatory clock
        ticks into the void.
      </p>

      <ul className="space-y-4">
        {NOTIFICATION_KINDS.map((kind) => {
          const meta = KIND_LABELS[kind];
          const rows = byKind[kind] ?? [];
          return (
            <li key={kind} className="rounded-md border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {meta.title}
                    {meta.required && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                        required
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{meta.body}</div>
                </div>
              </div>

              <ul className="mt-3 space-y-2">
                {rows.length === 0 && (
                  <li className="text-xs text-muted-foreground">No recipients yet.</li>
                )}
                {rows.map((row, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Select
                      value={row.recipient_profile_id ?? ""}
                      onValueChange={(v) =>
                        updateRow(kind, i, {
                          recipient_profile_id: v || undefined,
                          external_email: v ? undefined : row.external_email,
                        })
                      }
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="— pick a user —" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name ?? p.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">or</span>
                    <Input
                      type="email"
                      placeholder="external@example.com"
                      value={row.external_email ?? ""}
                      onChange={(e) =>
                        updateRow(kind, i, {
                          external_email: e.target.value || undefined,
                          recipient_profile_id: e.target.value ? undefined : row.recipient_profile_id,
                        })
                      }
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(kind, i)}
                      aria-label="Remove recipient"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => addRow(kind)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> Add recipient
              </button>
            </li>
          );
        })}
      </ul>

      {missingRequired.length > 0 && (
        <p className="text-sm text-destructive">
          Required: pick at least one recipient for {missingRequired.map((k) => KIND_LABELS[k].title).join(" and ")}.
        </p>
      )}

      <input type="hidden" name="recipients_json" value={JSON.stringify(payload)} />

      <StepFormError
        message={state?.ok === false ? state.error : undefined}
        isPending={isPending}
      />

      <StepFooter
        prevHref="/admin/site-setup/5"
        isPending={isPending}
        primaryDisabled={missingRequired.length > 0}
      />
    </form>
  );
}
