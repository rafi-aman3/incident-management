"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Bell, RefreshCcw, Sparkles, ShieldCheck } from "lucide-react";
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
  enableDemoMode,
  resetDemoData,
  triggerDemoBanner,
  loadSampleChain,
} from "@/app/(app)/admin/demo/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export function EnableDemoButton({ disabled }: { disabled?: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || isPending}
      onClick={() =>
        startTransition(async () => {
          const r = await enableDemoMode();
          if (r.ok) toast.success("Demo mode enabled — destructive actions now allowed");
          else toast.error(r.error);
        })
      }
    >
      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
      {isPending ? "Enabling…" : "Enable demo mode for this org"}
    </Button>
  );
}

export function TriggerBannerButton() {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    triggerDemoBanner,
    null
  );
  useEffect(() => {
    if (state?.ok) toast.success("Test banner inserted — visible on dashboard for 1 hour");
    if (state?.ok === false) toast.error(state.error);
  }, [state]);
  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" disabled={isPending} className="w-full">
        <Bell className="mr-1.5 h-4 w-4" />
        {isPending ? "Inserting…" : "Trigger banner"}
      </Button>
    </form>
  );
}

export function LoadSampleChainButton() {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    loadSampleChain,
    null
  );
  useEffect(() => {
    // Success path redirects, so we only see the failure case here.
    if (state?.ok === false) toast.error(state.error);
  }, [state]);
  return (
    <form action={formAction}>
      <Button type="submit" disabled={isPending} className="w-full">
        <Sparkles className="mr-1.5 h-4 w-4" />
        {isPending ? "Loading…" : "Load sample CAPA chain"}
      </Button>
    </form>
  );
}

/**
 * Reset = destructive + irreversible. Mirrors `<ArchiveSiteDialog>` (11a):
 * AlertDialog primitive + Stripe-style "Type <org_name> to confirm" guard.
 * Server validates `confirm_name` independently against `orgs.name` so a
 * curl bypass still requires the typed name.
 */
export function ResetDataButton({ orgName }: { orgName: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    resetDemoData,
    null
  );
  const [confirmName, setConfirmName] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Demo data wiped");
      setOpen(false);
      setConfirmName("");
    }
    if (state && state.ok === false && !state.fieldErrors) toast.error(state.error);
  }, [state]);

  const confirmErr =
    state?.ok === false ? state.fieldErrors?.confirm_name?.[0] : undefined;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" className="w-full">
          <RefreshCcw className="mr-1.5 h-4 w-4" aria-hidden />
          Reset demo data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Wipe all transactional data for {orgName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes every incident, investigation, CAPA, notification,
            activity event, and HSE record for this org. Foundational rows
            (sites, members, roles, annual hours) are preserved. Irreversible —
            re-run <span className="font-mono">pnpm db:seed</span> to restore
            seed data afterwards.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="expected_name" value={orgName} />
          <div className="space-y-1.5">
            <Label htmlFor="reset_confirm_name" className="text-xs">
              Type <span className="font-mono font-semibold">{orgName}</span> to confirm
            </Label>
            <Input
              id="reset_confirm_name"
              name="confirm_name"
              autoComplete="off"
              autoFocus
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              aria-invalid={!!confirmErr}
              aria-describedby={confirmErr ? "reset_confirm_err" : undefined}
            />
            {confirmErr && (
              <p id="reset_confirm_err" className="text-xs text-destructive">
                {confirmErr}
              </p>
            )}
          </div>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              disabled={isPending || confirmName !== orgName}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Wiping…" : "Yes, wipe it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
