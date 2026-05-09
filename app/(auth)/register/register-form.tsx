"use client";

import { useActionState } from "react";
import { signUp } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/incidents/schemas";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(signUp, null);

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;
  const formErr =
    state?.ok === false && !state.fieldErrors ? state.error : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          required
          aria-invalid={!!fieldErr("full_name")}
          aria-describedby={fieldErr("full_name") ? "full_name_err" : undefined}
        />
        {fieldErr("full_name") && (
          <p id="full_name_err" className="text-xs text-destructive">
            {fieldErr("full_name")}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={!!fieldErr("email")}
          aria-describedby={fieldErr("email") ? "email_err" : undefined}
        />
        {fieldErr("email") && (
          <p id="email_err" className="text-xs text-destructive">
            {fieldErr("email")}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!fieldErr("password")}
          aria-describedby={
            fieldErr("password") ? "password_err" : "password_help"
          }
        />
        {fieldErr("password") ? (
          <p id="password_err" className="text-xs text-destructive">
            {fieldErr("password")}
          </p>
        ) : (
          <p id="password_help" className="text-xs text-muted-foreground">
            At least 8 characters.
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
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
