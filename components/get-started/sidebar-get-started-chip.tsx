"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SidebarGetStartedChip({
  doneCount,
  totalCount,
}: {
  doneCount: number;
  totalCount: number;
}) {
  if (totalCount === 0 || doneCount >= totalCount) return null;

  const pct = Math.round((doneCount / totalCount) * 100);
  // Circumference for the collapsed ring (r=10 → C ≈ 62.83).
  const r = 10;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/get-started"
          aria-label={`Get started — ${doneCount} of ${totalCount} done`}
          className={cn(
            "group/get-started flex items-center gap-2 rounded-md border bg-card px-2.5 py-2 transition-colors hover:bg-accent/40",
            "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1"
          )}
        >
          <span
            className={cn(
              "relative grid h-7 w-7 place-items-center",
              "group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
            )}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="12" cy="12" r={r} className="fill-none stroke-muted" strokeWidth="2.5" />
              <circle
                cx="12"
                cy="12"
                r={r}
                className="fill-none stroke-primary"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${c - dash}`}
              />
            </svg>
            <Sparkles className="relative h-3.5 w-3.5 text-primary" />
          </span>

          <span className="flex flex-1 flex-col gap-1 group-data-[collapsible=icon]:hidden">
            <span className="flex items-center justify-between text-xs">
              <span className="font-semibold">Get started</span>
              <span className="font-medium text-primary">{doneCount}/{totalCount}</span>
            </span>
            <span className="h-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
            </span>
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">
        Get started · {doneCount}/{totalCount}
      </TooltipContent>
    </Tooltip>
  );
}
