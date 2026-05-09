"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/app/(app)/settings/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

type Initial = {
  full_name: string | null;
  email: string;
  department: string | null;
};

export function ProfileCard({ initial }: { initial: Initial }) {
  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(updateProfile, null);

  useEffect(() => {
    if (state?.ok) toast.success("Profile updated");
    if (state && state.ok === false && !state.fieldErrors)
      toast.error(state.error);
  }, [state]);

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <section
      aria-labelledby="settings-profile-heading"
      className="rounded-lg border bg-card p-5"
    >
      <div className="mb-4">
        <h2 id="settings-profile-heading" className="text-base font-semibold">
          Profile
        </h2>
        <p className="text-xs text-muted-foreground">
          What teammates see in the topbar, on incidents you report, and in
          activity timelines.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="settings_full_name" className="text-xs">
            Display name
          </Label>
          <Input
            id="settings_full_name"
            name="full_name"
            defaultValue={initial.full_name ?? ""}
            required
            aria-invalid={!!fieldErr("full_name")}
            aria-describedby={
              fieldErr("full_name") ? "settings_full_name_err" : undefined
            }
          />
          {fieldErr("full_name") && (
            <p id="settings_full_name_err" className="text-xs text-destructive">
              {fieldErr("full_name")}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings_department" className="text-xs">
            Department <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="settings_department"
            name="department"
            defaultValue={initial.department ?? ""}
            placeholder="e.g. Operations, EHS, Maintenance"
            aria-invalid={!!fieldErr("department")}
            aria-describedby={
              fieldErr("department") ? "settings_department_err" : undefined
            }
          />
          {fieldErr("department") && (
            <p id="settings_department_err" className="text-xs text-destructive">
              {fieldErr("department")}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings_email" className="text-xs">
            Email
          </Label>
          <Input
            id="settings_email"
            value={initial.email}
            disabled
            aria-readonly
            className="cursor-not-allowed bg-muted/40"
          />
          <p className="text-xs text-muted-foreground">
            Changing your email is a v2 feature. Contact your admin if you need
            it changed today.
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
