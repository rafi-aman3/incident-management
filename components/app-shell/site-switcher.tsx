"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Check, ChevronDown, Building2, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { setSelectedSite } from "./site-actions";

export type SwitcherSite = {
  id: string;
  name: string;
  country: "US" | "GB";
};

/**
 * Two variants:
 *   - "topbar" (default) — compact ghost button with a Radix dropdown
 *     popover. Lives in the desktop topbar above lg. Portal-rendered.
 *   - "sheet" — full-width vertical trigger with an INLINE collapsible
 *     list (no popover, no portal). Renders inside the mobile sidebar
 *     Sheet so the list can never overflow the drawer edge. On select
 *     it closes the sheet via setOpenMobile(false).
 */
export function SiteSwitcher({
  sites,
  currentSiteId,
  canCreateSite,
  variant = "topbar",
}: {
  sites: SwitcherSite[];
  currentSiteId: string | null;
  canCreateSite: boolean;
  variant?: "topbar" | "sheet";
}) {
  if (variant === "sheet") {
    return (
      <SheetSiteSwitcher
        sites={sites}
        currentSiteId={currentSiteId}
        canCreateSite={canCreateSite}
      />
    );
  }
  return (
    <TopbarSiteSwitcher
      sites={sites}
      currentSiteId={currentSiteId}
      canCreateSite={canCreateSite}
    />
  );
}

// ---------------------------------------------------------------------------
// Topbar variant — Radix dropdown popover.
// ---------------------------------------------------------------------------
function TopbarSiteSwitcher({
  sites,
  currentSiteId,
  canCreateSite,
}: {
  sites: SwitcherSite[];
  currentSiteId: string | null;
  canCreateSite: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const current = sites.find((s) => s.id === currentSiteId) ?? sites[0];

  function handleSelect(siteId: string) {
    startTransition(async () => {
      await setSelectedSite(siteId);
      // On /sites/[id], the URL param drives the page — refresh alone won't
      // re-render with the new site. Navigate so the URL follows the switch.
      if (pathname?.startsWith("/sites/")) {
        router.push(`/sites/${siteId}`);
      } else {
        router.refresh();
      }
    });
  }

  if (!current) {
    return (
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <Link href="/admin/sites/new">
          <Plus className="h-3.5 w-3.5" />
          <span>Create a site</span>
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" disabled={pending}>
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{current.name}</span>
          <span className="rounded bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            {current.country}
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>
          Your sites ({sites.length})
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sites.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onSelect={() => handleSelect(s.id)}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {s.name}
              <span className="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">
                {s.country}
              </span>
            </span>
            {s.id === current.id ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
        {canCreateSite && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/sites/new" className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span>Create new site</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Sheet variant — inline collapsible, NEVER renders a portal/popover.
// ---------------------------------------------------------------------------
function SheetSiteSwitcher({
  sites,
  currentSiteId,
  canCreateSite,
}: {
  sites: SwitcherSite[];
  currentSiteId: string | null;
  canCreateSite: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const { setOpenMobile } = useSidebar();
  const current = sites.find((s) => s.id === currentSiteId) ?? sites[0];

  function handleSelect(siteId: string) {
    if (siteId === current?.id) {
      // Tapping the current site just collapses the list.
      setExpanded(false);
      return;
    }
    startTransition(async () => {
      await setSelectedSite(siteId);
      setOpenMobile(false);
      if (pathname?.startsWith("/sites/")) {
        router.push(`/sites/${siteId}`);
      } else {
        router.refresh();
      }
    });
  }

  if (!current) {
    return (
      <Button asChild variant="outline" size="sm" className="w-full justify-start gap-1.5">
        <Link href="/admin/sites/new" onClick={() => setOpenMobile(false)}>
          <Plus className="h-3.5 w-3.5" />
          <span>Create a site</span>
        </Link>
      </Button>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        disabled={pending}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse site list" : "Expand site list"}
        className="flex h-auto w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left transition hover:bg-accent disabled:opacity-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <span className="truncate text-sm font-medium">{current.name}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {current.country} · Current site
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 opacity-60 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="overflow-hidden rounded-md border bg-popover text-popover-foreground">
          <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Your sites ({sites.length})
          </div>
          <ul className="max-h-[40vh] overflow-y-auto border-t">
            {sites.map((s) => {
              const isCurrent = s.id === current.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(s.id)}
                    disabled={pending}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-accent disabled:opacity-50",
                      isCurrent && "bg-accent/40",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate">{s.name}</span>
                      <span className="rounded bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {s.country}
                      </span>
                    </span>
                    {isCurrent && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {canCreateSite && (
            <Link
              href="/admin/sites/new"
              onClick={() => setOpenMobile(false)}
              className="flex items-center gap-2 border-t px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              <span>Create new site</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
