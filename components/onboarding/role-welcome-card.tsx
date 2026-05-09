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
import {
  ROLE_WELCOME_CONTENT,
  type RoleWelcomeContent,
} from "@/lib/onboarding/role-welcome-content";

// Re-export so existing call sites that import from this file keep working.
export { ROLE_WELCOME_CONTENT };
export type { RoleWelcomeContent };

/**
 * Reusable first-login welcome dialog. The supervisor / EHS-manager /
 * site_admin variants pass their own copy + deep-links; the dismiss action
 * flips profiles.seen_welcome so the modal never returns.
 *
 * The verifier welcome is context-driven (not first-login) and uses a
 * separate component — see VerifierWelcomeCard.
 */
export function RoleWelcomeCard({
  firstName,
  content,
}: {
  firstName: string;
  content: RoleWelcomeContent | undefined;
}) {
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  const dismiss = () => {
    startTransition(async () => {
      await markWelcomeSeen();
      setOpen(false);
    });
  };

  if (!content) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>👋 {content.title.replace("{firstName}", firstName)}</DialogTitle>
          <DialogDescription>{content.description}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{content.body}</p>
        <DialogFooter className="sm:justify-between">
          {content.secondary && (
            <Link
              href={content.secondary.href}
              onClick={dismiss}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              {content.secondary.label}
            </Link>
          )}
          <Link
            href={content.primary.href}
            onClick={dismiss}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {content.primary.label}
          </Link>
          <button
            type="button"
            onClick={dismiss}
            disabled={isPending}
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            Got it
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
