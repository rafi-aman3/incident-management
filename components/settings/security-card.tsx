"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  changePassword,
  signOutEverywhere,
} from "@/app/(app)/settings/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export function SecurityCard() {
  return (
    <section
      aria-labelledby="settings-security-heading"
      className="rounded-lg border bg-card p-5"
    >
      <div className="mb-4">
        <h2 id="settings-security-heading" className="text-base font-semibold">
          Security
        </h2>
        <p className="text-xs text-muted-foreground">
          Update your password and sign out from any device that may have lost
          its session.
        </p>
      </div>

      <PasswordForm />

      <div className="mt-6 border-t pt-4">
        <SignOutEverywhereButton />
      </div>
    </section>
  );
}

function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(changePassword, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Password updated");
      formRef.current?.reset();
    }
    if (state && state.ok === false && !state.fieldErrors)
      toast.error(state.error);
  }, [state]);

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <PwField
        id="settings_current_pw"
        name="current_password"
        label="Current password"
        autoComplete="current-password"
        error={fieldErr("current_password")}
      />
      <PwField
        id="settings_new_pw"
        name="new_password"
        label="New password"
        autoComplete="new-password"
        helper="At least 8 characters, and different from your current password."
        error={fieldErr("new_password")}
      />
      <PwField
        id="settings_confirm_pw"
        name="confirm_password"
        label="Confirm new password"
        autoComplete="new-password"
        error={fieldErr("confirm_password")}
      />
      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}

function PwField({
  id,
  name,
  label,
  autoComplete,
  helper,
  error,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  helper?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        aria-invalid={!!error}
        aria-describedby={
          error ? `${id}_err` : helper ? `${id}_help` : undefined
        }
      />
      {error ? (
        <p id={`${id}_err`} className="text-xs text-destructive">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}_help`} className="text-xs text-muted-foreground">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

/**
 * AlertDialog confirm — sign out from every device including this one.
 * Server action invalidates every refresh token via the admin client and
 * redirects to /login?signed_out=everywhere; we never see ok=true.
 */
function SignOutEverywhereButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Sign out from all devices</p>
          <p className="text-xs text-muted-foreground">
            Forces every active session for this account to sign in again. You
            will be signed out on this device too.
          </p>
        </div>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" className="self-start sm:self-auto">
            <LogOut className="mr-1.5 h-4 w-4" aria-hidden />
            Sign out everywhere
          </Button>
        </AlertDialogTrigger>
      </div>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out from all devices?</AlertDialogTitle>
          <AlertDialogDescription>
            Every browser, tab, and device you&apos;re currently signed in on
            will be signed out — including this one. You&apos;ll need to sign
            back in with your password.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await signOutEverywhere();
              })
            }
          >
            {isPending ? "Signing out…" : "Yes, sign out everywhere"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
