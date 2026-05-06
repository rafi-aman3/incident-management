"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// UI shell only. Phase 07 hydrates the search backend, query input,
// results, and wires the ⌘K shortcut. The kbd badge below is decorative
// — pressing ⌘K does nothing today (intentional).
//
// `variant="input"` renders the centred search-bar button (md+); `"icon"`
// renders the compact icon button (< md). The topbar mounts both with
// opposite responsive wrappers so only one ever shows at any width.
export function SearchTrigger({ variant }: { variant: "input" | "icon" }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "input" ? (
          <button
            type="button"
            aria-label="Search"
            className={cn(
              "group flex h-9 w-full max-w-[420px] items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground ring-1 ring-transparent transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-ring xl:max-w-[520px]"
            )}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="pointer-events-none hidden select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        ) : (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>
            Global search across incidents, inspections, templates, assets,
            and documents lands in Phase 07. The shell ships now so the
            topbar geometry is locked.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Coming soon — Phase 07.
        </div>
      </DialogContent>
    </Dialog>
  );
}
