"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChecklistRowState } from "@/lib/get-started/state";
import { ChecklistRow } from "./checklist-row";

export function ShowDismissedToggle({ rows }: { rows: ChecklistRowState[] }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        {open ? "Hide" : "Show"} {rows.length} dismissed item{rows.length === 1 ? "" : "s"}
      </button>
      {open && (
        <ul className="mt-2 overflow-hidden rounded-md border bg-card">
          {rows.map((row) => (
            <ChecklistRow key={row.item.id} row={row} allowDismiss />
          ))}
        </ul>
      )}
    </div>
  );
}
