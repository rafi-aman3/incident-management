"use client";

import { useActionState } from "react";
import { setNewPassword } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/incidents/schemas";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(setNewPassword, null);

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;
  const formErr =
    state?.ok === false && !state.fieldErrors ? state.error : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="new_password">New password</Label>
        <Input
          id="new_password"
          name="new_password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!fieldErr("new_password")}
          aria-describedby={
            fieldErr("new_password") ? "new_password_err" : undefined
          }
        />
        {fieldErr("new_password") && (
          <p id="new_password_err" className="text-xs text-destructive">
            {fieldErr("new_password")}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirm_password">Confirm password</Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!fieldErr("confirm_password")}
          aria-describedby={
            fieldErr("confirm_password") ? "confirm_password_err" : undefined
          }
        />
        {fieldErr("confirm_password") && (
          <p id="confirm_password_err" className="text-xs text-destructive">
            {fieldErr("confirm_password")}
          </p>
        )}
      </div>

      {formErr ? (
        <p role="alert" className="text-sm text-destructive">
          {formErr}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
