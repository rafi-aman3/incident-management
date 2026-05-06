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
import { setSelectedSite } from "./site-actions";

export type SwitcherSite = {
  id: string;
  name: string;
  country: "US" | "GB";
};

export function SiteSwitcher({
  sites,
  currentSiteId,
  canCreateSite,
}: {
  sites: SwitcherSite[];
  currentSiteId: string | null;
  canCreateSite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = sites.find((s) => s.id === currentSiteId) ?? sites[0];

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
            onSelect={() =>
              startTransition(async () => {
                await setSelectedSite(s.id);
                router.refresh();
              })
            }
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
