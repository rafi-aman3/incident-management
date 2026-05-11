"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { setSelectedSite } from "./site-actions";

export type SwitcherSite = {
  id: string;
  name: string;
  country: "US" | "GB";
};

/**
 * Two variants:
 *   - "topbar" (default) — compact ghost button with site name + country
 *     pill; lives in the desktop topbar above lg.
 *   - "sheet" — full-width vertical trigger; mounted inside the mobile
 *     sidebar Sheet so the topbar doesn't overflow at narrow widths.
 *     On select, auto-closes the sheet via setOpenMobile(false).
 *
 * Both variants share the same DropdownMenu list, so the keyboard +
 * selected-row markers behave identically.
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { setOpenMobile } = useSidebar();
  const current = sites.find((s) => s.id === currentSiteId) ?? sites[0];

  function handleSelect(siteId: string) {
    startTransition(async () => {
      await setSelectedSite(siteId);
      if (variant === "sheet") setOpenMobile(false);
      router.refresh();
    });
  }

  if (!current) {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        className={variant === "sheet" ? "w-full justify-start gap-1.5" : "gap-1.5"}
      >
        <Link
          href="/admin/sites/new"
          onClick={() => variant === "sheet" && setOpenMobile(false)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Create a site</span>
        </Link>
      </Button>
    );
  }

  const trigger =
    variant === "sheet" ? (
      <Button
        variant="outline"
        className="h-auto w-full justify-between gap-2 px-3 py-2"
        disabled={pending}
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
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </Button>
    ) : (
      <Button variant="ghost" size="sm" className="gap-2" disabled={pending}>
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{current.name}</span>
        <span className="rounded bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {current.country}
        </span>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </Button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={variant === "sheet" ? "w-[calc(100vw-3rem)] max-w-sm" : "w-64"}
      >
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
              <Link
                href="/admin/sites/new"
                onClick={() => variant === "sheet" && setOpenMobile(false)}
                className="flex items-center gap-2"
              >
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
