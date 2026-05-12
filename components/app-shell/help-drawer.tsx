"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle, BookOpen, MessageCircle, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { RoleKey } from "@/lib/supabase/auth";

type ShortLink = { label: string; href: string; description: string };

const ROLE_LINKS: Record<RoleKey, ShortLink[]> = {
  worker: [
    { label: "Report an incident", href: "/incidents/new/1", description: "Start the 3-step wizard." },
    { label: "Practice mode", href: "/incidents/new/1?sandbox=true", description: "Try the wizard with a sandbox flag — won't affect KPIs." },
    { label: "My reports", href: "/incidents", description: "See incidents you've filed." },
  ],
  supervisor: [
    { label: "Triage queue", href: "/incidents", description: "All incidents on your sites — filter by status to find work." },
    { label: "Active investigations", href: "/investigations", description: "Kanban view of investigations on your sites." },
    { label: "CAPAs awaiting verification", href: "/capa?tab=pending_verification", description: "Where your verifier hat lives." },
  ],
  ehs_manager: [
    { label: "Investigations Kanban", href: "/investigations", description: "Drag cards through Pending → In Progress → Awaiting CAPA → Closed." },
    { label: "Reports landing", href: "/reports", description: "OSHA 300 / 300A / 301 + RIDDOR F2508." },
    { label: "All CAPAs", href: "/capa?tab=all", description: "Cross-site view; sort by overdue first." },
  ],
  site_admin: [
    { label: "Site Setup", href: "/admin/site-setup", description: "7-step wizard for a new site." },
    { label: "Demo affordances", href: "/admin/demo", description: "Reset / sample-load / trigger banner — for stakeholder demos." },
    { label: "Reports", href: "/reports", description: "Annual hours editor + 300A poster." },
  ],
};

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Why can't the CAPA owner verify their own action?",
    a: "OSHA §1904 requires independent verification — otherwise the same person 'fixes it' and 'grades' it. We block the owner at UI, server, RPC, and DB layers.",
  },
  {
    q: "When does the regulatory clock start?",
    a: "On classification (Wizard step 3). Severity → reportability → notifications all fire at the same instant. Investigations can take weeks — clocks don't wait.",
  },
  {
    q: "What's a sandbox incident?",
    a: "A practice report. Excluded from KPIs, dashboards, and regulatory paperwork. Auto-deleted after 7 days. Toggle on Step 1.",
  },
  {
    q: "What happens with 'partially effective' verification?",
    a: "The CAPA closes (verified) AND a new follow-up CAPA spawns automatically with the same owner, in 'created' state. The page surfaces the chain.",
  },
];

/**
 * Help center side panel. Triggered by the ? icon in the topbar; slides in
 * from the right. Role-aware short links + a static FAQ. Lightweight for v1
 * — a real Help Center pulls from a CMS or shared docs source.
 */
export function HelpDrawer({ roleKey }: { roleKey: RoleKey }) {
  const [open, setOpen] = useState(false);
  const links = ROLE_LINKS[roleKey] ?? [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Help"
          className="h-8 w-8"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" /> Help
          </SheetTitle>
          <SheetDescription>
            Quick links for your role + answers to the most common regulatory
            questions.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <BookOpen className="h-3 w-3" /> Shortcuts
            </h3>
            <ul className="space-y-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-md border bg-card p-2.5 hover:border-primary"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{l.label}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {l.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageCircle className="h-3 w-3" /> Frequently asked
            </h3>
            <ul className="space-y-3">
              {FAQ.map((entry) => (
                <li key={entry.q}>
                  <p className="text-sm font-medium">{entry.q}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {entry.a}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-md border bg-muted/30 p-3 text-[10px] text-muted-foreground">
            TitanEHS · v1.0
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
