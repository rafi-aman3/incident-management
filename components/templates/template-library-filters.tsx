"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  INDUSTRY_VALUES,
  industryLabel,
  type IndustryEnum,
} from "@/lib/templates/industry-map";
import type { TemplateStatus } from "@/lib/templates/types";

type Mode = "browse" | "imported";

const STATUS_OPTIONS: { value: TemplateStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function TemplateLibraryFilters({ mode }: { mode: Mode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const currentIndustry = sp.get("industry") ?? "";
  const currentStatus = sp.get("status") ?? "";
  const currentFeatured = sp.get("featured") === "1";
  const currentQ = sp.get("q") ?? "";

  // Local-only state for the search input so typing doesn't fire a
  // navigation per keystroke. Submit happens on Enter / blur.
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
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    router.push(pathname);
  }

  const hasActive = currentIndustry || currentStatus || currentFeatured || currentQ;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", q);
        }}
        className="relative flex-1 min-w-[240px] max-w-md"
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search templates"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => {
            if (q !== currentQ) setParam("q", q);
          }}
          className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      {/* Industry pills */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setParam("industry", null)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium",
            !currentIndustry
              ? "border-primary bg-primary/10 text-primary"
              : "bg-background text-muted-foreground hover:bg-accent"
          )}
        >
          All industries
        </button>
        {INDUSTRY_VALUES.map((ind: IndustryEnum) => (
          <button
            key={ind}
            type="button"
            onClick={() => setParam("industry", ind)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              currentIndustry === ind
                ? "border-primary bg-primary/10 text-primary"
                : "bg-background text-muted-foreground hover:bg-accent"
            )}
          >
            {industryLabel(ind)}
          </button>
        ))}
      </div>

      {mode === "browse" && (
        <button
          type="button"
          onClick={() => setParam("featured", currentFeatured ? null : "1")}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium",
            currentFeatured
              ? "border-primary bg-primary/10 text-primary"
              : "bg-background text-muted-foreground hover:bg-accent"
          )}
        >
          Featured
        </button>
      )}

      {mode === "imported" && (
        <select
          value={currentStatus}
          onChange={(e) => setParam("status", e.target.value || null)}
          className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

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
