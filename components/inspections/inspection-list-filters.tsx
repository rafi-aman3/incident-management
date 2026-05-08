"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InspectionStatus } from "@/lib/templates/types";

const STATUS_OPTIONS: { value: InspectionStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

export function InspectionListFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const currentStatus = sp.get("status") ?? "";
  const currentQ = sp.get("q") ?? "";

  // Local-only state for the search input so typing doesn't fire a navigation
  // per keystroke. Submit happens on Enter / blur (mirrors template-library-filters).
  const [q, setQ] = useState(currentQ);
  useEffect(() => {
    setQ(currentQ);
  }, [currentQ]);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll() {
    router.push(pathname);
  }

  const hasActive = currentStatus || currentQ;

  return (
    <div className={cn("flex flex-wrap items-center gap-2")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", q);
        }}
        className="relative min-w-[220px] flex-1 max-w-md"
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => {
            if (q !== currentQ) setParam("q", q);
          }}
          placeholder="Search inspection title"
          className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      <select
        value={currentStatus}
        onChange={(e) => setParam("status", e.target.value || null)}
        className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Filter by status"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {hasActive && (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}
