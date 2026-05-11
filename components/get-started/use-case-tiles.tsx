"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import { USE_CASES, type UseCaseKey } from "@/lib/get-started/use-cases";
import { cn } from "@/lib/utils";

export function UseCaseTiles({
  selected,
  onToggle,
}: {
  selected: ReadonlySet<UseCaseKey>;
  onToggle: (key: UseCaseKey) => void;
}) {
  const labelId = useId();
  return (
    <ul
      role="group"
      aria-labelledby={labelId}
      className="grid gap-2.5 sm:grid-cols-2"
    >
      <span id={labelId} className="sr-only">
        Use-cases
      </span>
      {USE_CASES.map((uc) => {
        const Icon = uc.icon;
        const isSel = selected.has(uc.key);
        return (
          <li key={uc.key} className={uc.key === "planner" ? "sm:col-span-2" : undefined}>
            <button
              type="button"
              onClick={() => onToggle(uc.key)}
              aria-pressed={isSel}
              className={cn(
                "group flex w-full items-start gap-3 rounded-lg border p-3.5 text-left transition-colors",
                isSel
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "border-border bg-card hover:bg-accent/40"
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-md",
                  isSel ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {uc.label}
                  {isSel && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      <Check className="h-2.5 w-2.5" aria-hidden /> Picked
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {uc.description}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
