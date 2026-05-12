"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { setSelectedSite } from "@/components/app-shell/site-actions";

export type ChooseSiteOption = {
  id: string;
  name: string;
};

// Org-mode Quick action picker. Sets the topbar site cookie via the existing
// SiteSwitcher server action so downstream wizards read the right
// currentSiteId from requireUser() — no ?site= URL contract needed.
export function ChooseSiteSheet({
  open,
  onOpenChange,
  sites,
  destination,
  destinationLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sites: ChooseSiteOption[];
  destination: string;
  destinationLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState<string | null>(null);

  function go(id: string) {
    setPicking(id);
    startTransition(async () => {
      await setSelectedSite(id);
      router.push(destination);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Choose a site</SheetTitle>
          <SheetDescription>
            Pick the site this {destinationLabel} belongs to.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-1 px-4">
          {sites.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No sites available. Create one in /admin/sites/new first.
            </p>
          )}
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              disabled={pending}
              className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
            >
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="flex-1 truncate">{s.name}</span>
              {picking === s.id && (
                <span className="text-xs text-muted-foreground">…</span>
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
