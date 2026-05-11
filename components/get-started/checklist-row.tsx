"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissItem, undismissItem } from "@/app/(app)/get-started/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ChecklistRowState } from "@/lib/get-started/state";

export function ChecklistRow({ row, allowDismiss }: { row: ChecklistRowState; allowDismiss: boolean }) {
  const [pending, startTransition] = useTransition();
  const { item, done, dismissed } = row;
  const isInfoOnly = item.ctaHref === null;

  return (
    <li
      className={cn(
        "flex items-center gap-3 border-t border-border/60 px-3.5 py-3 first:border-t-0",
        row.counted ? "bg-card" : "bg-card/60",
        !row.counted && "hover:bg-accent/30"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full",
          done ? "bg-success text-white" :
          dismissed ? "bg-muted text-muted-foreground" :
          "border-2 border-border"
        )}
      >
        {done && <Check className="h-3 w-3" />}
        {!done && dismissed && <X className="h-3 w-3" />}
      </span>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-sm font-medium",
            (done || dismissed) && "text-muted-foreground line-through"
          )}
        >
          {item.label}
        </div>
        {item.description && (
          <div className="text-xs text-muted-foreground">{item.description}</div>
        )}
      </div>

      {!isInfoOnly && !done && !dismissed && (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs"
        >
          <Link href={item.ctaHref!}>{item.ctaLabel || "Open"} →</Link>
        </Button>
      )}

      {allowDismiss && !done && !dismissed && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await dismissItem(item.id);
              if (!res.ok) toast.error(res.error);
            })
          }
        >
          Dismiss
        </Button>
      )}

      {allowDismiss && dismissed && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await undismissItem(item.id);
              if (!res.ok) toast.error(res.error);
            })
          }
        >
          Un-dismiss
        </Button>
      )}
    </li>
  );
}
