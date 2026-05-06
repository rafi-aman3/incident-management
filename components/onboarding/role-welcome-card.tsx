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

export type RoleWelcomeContent = {
  title: string;
  description: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
};

/**
 * Reusable first-login welcome dialog. The worker / supervisor / EHS-manager
 * variants pass their own copy + deep-links; the dismiss action flips
 * profiles.seen_welcome so the modal never returns.
 *
 * The verifier welcome is context-driven (not first-login) and uses a
 * separate component — see VerifierWelcomeCard.
 */
export function RoleWelcomeCard({
  firstName,
  content,
}: {
  firstName: string;
  content: RoleWelcomeContent;
}) {
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

export const ROLE_WELCOME_CONTENT: Record<
  "supervisor" | "ehs_manager" | "site_admin",
  RoleWelcomeContent
> = {
  supervisor: {
    title: "Welcome, {firstName}",
    description:
      "You triage incidents reported by your team — review classifications, assign owners, escalate to investigation.",
    body: "Look at the Incidents list to see what's queued. The 4 triage modals (override severity, assign owner, escalate, close) live on the incident detail page.",
    primary: { label: "Open incidents", href: "/incidents" },
    secondary: { label: "Practice report", href: "/incidents/new/1?sandbox=true" },
  },
  ehs_manager: {
    title: "Welcome, {firstName}",
    description:
      "You lead investigations, assign CAPAs, and own the regulatory paperwork. The whole pipeline reads from here.",
    body: "Investigations Kanban shows what's open. CAPAs in pending verification need an independent verifier — assign someone other than the owner. The Reports module renders OSHA 300 / 300A / 301 and RIDDOR F2508 directly from your data.",
    primary: { label: "Open Kanban", href: "/investigations" },
    secondary: { label: "Reports", href: "/reports" },
  },
  site_admin: {
    title: "Welcome, {firstName}",
    description:
      "You configure the site, manage users, and have access to the demo affordances. Start with Site Setup if you haven't already.",
    body: "Use the demo page to load a sample CAPA chain or trigger a test banner for screencaps. Reset Demo Data wipes everything back to seed — only available on demo orgs.",
    primary: { label: "Demo affordances", href: "/admin/demo" },
    secondary: { label: "Open Kanban", href: "/investigations" },
  },
};
