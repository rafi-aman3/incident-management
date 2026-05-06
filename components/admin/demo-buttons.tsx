"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Bell, RefreshCcw, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function ResetDataButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    resetDemoData,
    null
  );
  useEffect(() => {
    if (state?.ok) {
      toast.success("Demo data wiped");
      setOpen(false);
    }
    if (state?.ok === false) toast.error(state.error);
  }, [state]);
  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        <RefreshCcw className="mr-1.5 h-4 w-4" />
        Reset demo data
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wipe all transactional data?</DialogTitle>
            <DialogDescription>
              This deletes every incident, investigation, CAPA, notification,
              activity event, and HSE record for this org. Foundational rows
              (sites, members, roles, annual hours) are preserved. This is
              irreversible — only the seed data is restored when you re-run
              <span className="font-mono"> pnpm db:seed</span>.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction}>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? "Wiping…" : "Yes, wipe it"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
