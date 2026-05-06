"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "verifier-welcome-shown-v1";

/**
 * Verifier welcome — context-driven, NOT first-login. Per the plan §22,
 * fires once per browser session on the first /capa/[id] visit where
 * viewer is the assigned verifier and status=pending_verification.
 *
 * Uses sessionStorage rather than profiles.seen_welcome so the worker's
 * dismissal of their welcome card doesn't suppress this one. Across
 * sessions, the dialog returns — verifying CAPAs is rare enough that a
 * once-per-session reminder is the right cadence.
 *
 * The page guards on (status, isAssignedVerifier) — this component only
 * adds the "shown this session?" check.
 */
export function VerifierWelcomeCard({ capaTitle }: { capaTitle: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(STORAGE_KEY) === "1") return;
    setOpen(true);
  }, []);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> You&apos;re the verifier
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{capaTitle}</span> is awaiting your
            independent verification. The owner can&apos;t verify their own
            work — that&apos;s why this is on you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>
            Pick how you verified (inspection / monitoring / audit trend /
            re-interview / document review), then the outcome:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
            <li><strong>Effective</strong> — the action worked. CAPA closes.</li>
            <li><strong>Partially effective</strong> — residual risk; a follow-up CAPA spawns automatically.</li>
            <li><strong>Not effective</strong> — back to the owner with a rejection reason.</li>
            <li><strong>Too early</strong> — pick a re-verification date.</li>
          </ul>
        </div>
        <DialogFooter>
          <Button type="button" onClick={dismiss}>
            Got it — let me verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
