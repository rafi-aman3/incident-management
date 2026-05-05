"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { REG_TOOLTIPS, type TooltipKey } from "@/lib/constants/tooltips";

/**
 * Inline "?" icon next to a regulatory term. Hover/focus shows the registered
 * one-sentence explanation. Used at the placements listed in
 * docs/onboarding.md §9.1.
 */
export function InfoTooltip({ tip }: { tip: TooltipKey }) {
  const meta = REG_TOOLTIPS[tip];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${meta.term}?`}
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-snug">
        <p className="font-medium">{meta.term}</p>
        <p className="mt-1">{meta.copy}</p>
      </TooltipContent>
    </Tooltip>
  );
}
