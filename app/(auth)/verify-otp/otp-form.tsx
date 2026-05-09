"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { verifyOtp, resendOtp } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/incidents/schemas";

export function OtpForm({
  email,
  demoHint,
}: {
  email: string;
  demoHint: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(verifyOtp, null);
  const [resendState, resendAction, resendPending] = useActionState<
    ActionResult | null,
    FormData
  >(resendOtp, null);

  useEffect(() => {
    if (resendState?.ok) toast.success("Code resent — check your inbox.");
    if (resendState?.ok === false) toast.error(resendState.error);
  }, [resendState]);

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;
  const formErr =
    state?.ok === false && !state.fieldErrors ? state.error : undefined;

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />

        <div className="grid gap-2">
          <Label htmlFor="code">Verification code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••"
            required
            autoFocus
            className="text-center text-lg tracking-[0.5em] font-mono"
            aria-invalid={!!fieldErr("code")}
            aria-describedby={
              fieldErr("code")
                ? "code_err"
                : demoHint
                  ? "code_hint"
                  : undefined
            }
          />
          {fieldErr("code") ? (
            <p id="code_err" className="text-xs text-destructive">
              {fieldErr("code")}
            </p>
          ) : demoHint ? (
            <p
              id="code_hint"
              className="rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-foreground"
            >
              <span className="font-semibold">DEMO:</span> enter{" "}
              <code className="font-mono">{demoHint}</code> to verify.
            </p>
          ) : null}
        </div>

        {formErr ? (
          <p role="alert" className="text-sm text-destructive">
            {formErr}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Verifying…" : "Verify and continue"}
        </Button>
      </form>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Code sent to {email}</span>
        <form action={resendAction}>
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={resendPending}
            className="font-medium text-brand underline underline-offset-2 hover:no-underline disabled:opacity-50"
          >
            {resendPending ? "Resending…" : "Resend code"}
          </button>
        </form>
      </div>
    </div>
  );
}
