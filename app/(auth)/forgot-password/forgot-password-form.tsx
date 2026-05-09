"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { requestPasswordReset } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/incidents/schemas";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(requestPasswordReset, null);

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;
  const formErr =
    state?.ok === false && !state.fieldErrors ? state.error : undefined;

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-success/5 p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
        <h2 className="text-base font-semibold">Check your inbox</h2>
        <p className="text-sm text-muted-foreground">
          If that email is registered, we&apos;ve sent a link to set a new
          password. The link expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
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

      {formErr ? (
        <p role="alert" className="text-sm text-destructive">
          {formErr}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
