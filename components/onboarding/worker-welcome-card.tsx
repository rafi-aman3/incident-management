"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { markWelcomeSeen } from "@/lib/actions/onboarding";

/**
 * Worker welcome card per docs/onboarding.md §6.1. First-login modal gated on
 * profile.seen_welcome=false. "Try a practice report" deep-links to the
 * wizard with sandbox=true; "Got it" dismisses and flips seen_welcome.
 *
 * Other roles' welcome cards (supervisor, EHS Manager, verifier) come in
 * Phase 2 — Phase 1 ships the worker card only.
 */
export function WorkerWelcomeCard({ firstName }: { firstName: string }) {
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  const dismiss = () => {
    startTransition(async () => {
      await markWelcomeSeen();
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>👋 Welcome, {firstName}</DialogTitle>
          <DialogDescription>
            This is where you report any safety event at work. Reporting takes about 3 minutes.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Nobody gets in trouble for reporting a near-miss. Reporting helps everyone stay safe.
        </p>
        <DialogFooter className="sm:justify-between">
          <Link
            href="/incidents/new/1?sandbox=true"
            onClick={dismiss}
            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Try a practice report
          </Link>
          <button
            type="button"
            onClick={dismiss}
            disabled={isPending}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Got it
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
