"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Building2, CalendarRange } from "lucide-react";
import {
  PLANNER_EVENT_KINDS,
  PLANNER_EVENT_LABEL,
  type PlannerEventKind,
} from "@/lib/planner/types";
import type { PlannerView } from "@/lib/planner/range";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const VIEWS: ReadonlyArray<{ value: PlannerView; label: string }> = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

export type PlannerFiltersProps = {
  view: PlannerView;
  date: string; // yyyy-MM-dd
  siteParam: string; // "" (= current), "all", or site_id
  enabledKinds: ReadonlyArray<PlannerEventKind>;
  sites: ReadonlyArray<{ id: string; name: string; country: "US" | "GB" }>;
  currentSiteId: string | null;
};

export function PlannerFilters({
  view,
  date,
  siteParam,
  enabledKinds,
  sites,
  currentSiteId,
}: PlannerFiltersProps) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  const enabled = new Set<PlannerEventKind>(enabledKinds);

  const updateParams = (
    fn: (params: URLSearchParams) => void,
  ): void => {
    const next = new URLSearchParams(search.toString());
    fn(next);
    startTransition(() => {
      router.push(`/planner?${next.toString()}`);
    });
  };

  const onView = (v: PlannerView) =>
    updateParams((p) => {
      p.set("view", v);
    });

  const onDate = (newDate: string) =>
    updateParams((p) => {
      p.set("date", newDate);
    });

  const onSite = (value: string) =>
    updateParams((p) => {
      if (value === "current") p.delete("site");
      else p.set("site", value);
    });

  const onToggleKind = (kind: PlannerEventKind) =>
    updateParams((p) => {
      // Verbose URL shape (resolved Q2): each disabled kind sets `<kind>=0`.
      // Re-enabling deletes the param entirely.
      if (enabled.has(kind)) p.set(kind, "0");
      else p.delete(kind);
    });

  const goToday = () => {
    const today = new Date();
    const yyyyMmDd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    onDate(yyyyMmDd);
  };

  const siteSelectValue = siteParam === "" ? "current" : siteParam;
  const currentSite = sites.find((s) => s.id === currentSiteId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* View toggle */}
      <div className="inline-flex rounded-md border bg-card p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            disabled={pending}
            onClick={() => onView(v.value)}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors",
              view === v.value
                ? "bg-brand text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Date stepper — native date input keeps it lightweight; URL stays the truth */}
      <div className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1">
        <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="date"
          value={date}
          disabled={pending}
          onChange={(e) => onDate(e.target.value)}
          className="bg-transparent text-xs outline-none"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={goToday}
        className="h-7 text-xs"
      >
        Today
      </Button>

      {/* Site picker */}
      <Select value={siteSelectValue} onValueChange={onSite} disabled={pending}>
        <SelectTrigger className="h-7 w-auto gap-1.5 text-xs" aria-label="Site filter">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {currentSite ? (
            <SelectItem value="current">Current site · {currentSite.name}</SelectItem>
          ) : null}
          <SelectItem value="all">All accessible sites</SelectItem>
          {sites
            .filter((s) => s.id !== currentSiteId)
            .map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} <span className="ml-1 text-muted-foreground">({s.country})</span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      {/* Event-type chips */}
      <div className="flex flex-wrap items-center gap-1">
        {PLANNER_EVENT_KINDS.map((kind) => {
          const on = enabled.has(kind);
          return (
            <button
              key={kind}
              type="button"
              disabled={pending}
              onClick={() => onToggleKind(kind)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                on
                  ? "border-brand/30 bg-brand-soft text-brand"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={on}
            >
              {PLANNER_EVENT_LABEL[kind]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
