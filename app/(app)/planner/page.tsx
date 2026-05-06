import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { aggregatePlannerEvents } from "@/lib/planner/aggregate";
import { rangeFor, type PlannerView } from "@/lib/planner/range";
import {
  PLANNER_EVENT_KINDS,
  type PlannerEventKind,
} from "@/lib/planner/types";
import { PlannerMonth } from "@/components/planner/planner-month";
import { PlannerWeek } from "@/components/planner/planner-week";
import { PlannerDay } from "@/components/planner/planner-day";
import { PlannerFilters } from "@/components/planner/planner-filters";
import { InfoTooltip } from "@/components/info-tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Site = {
  id: string;
  name: string;
  country: "US" | "GB";
  parent_site_id: string | null;
};

const VALID_VIEWS = new Set<PlannerView>(["month", "week", "day"]);

function parseView(raw: string | string[] | undefined): PlannerView {
  if (typeof raw === "string" && VALID_VIEWS.has(raw as PlannerView)) {
    return raw as PlannerView;
  }
  return "month";
}

function parseDate(raw: string | string[] | undefined): Date {
  if (typeof raw === "string") {
    const d = parseISO(raw);
    if (isValid(d)) return d;
  }
  return new Date();
}

function pickFirst(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return "";
}

/** Verbose URL shape: each disabled kind is `?<kind>=0`. Absence = enabled. */
function parseEnabledKinds(
  sp: Record<string, string | string[] | undefined>,
): PlannerEventKind[] {
  return PLANNER_EVENT_KINDS.filter((k) => pickFirst(sp[k]) !== "0");
}

/** Walks the org's site tree, expanding each membership's include_children flag. */
function resolveAccessibleSites(
  allSites: Site[],
  memberships: ReadonlyArray<{ site_id: string; include_children: boolean }>,
): Site[] {
  const byParent = new Map<string | null, Site[]>();
  for (const s of allSites) {
    const arr = byParent.get(s.parent_site_id) ?? [];
    arr.push(s);
    byParent.set(s.parent_site_id, arr);
  }

  const accessible = new Set<string>();
  for (const m of memberships) {
    if (accessible.has(m.site_id)) continue;
    accessible.add(m.site_id);
    if (m.include_children) {
      const queue = [m.site_id];
      while (queue.length > 0) {
        const sid = queue.shift()!;
        for (const child of byParent.get(sid) ?? []) {
          if (!accessible.has(child.id)) {
            accessible.add(child.id);
            queue.push(child.id);
          }
        }
      }
    }
  }

  return allSites.filter((s) => accessible.has(s.id));
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, profile, memberships, currentSiteId } = await requireUser();

  // ---- gate ----
  const canRead = currentSiteId ? await can("planner:read", currentSiteId) : false;
  if (!canRead) {
    return (
      <EmptyShell title="Planner unavailable" message="You don't have permission to view the planner at the current site." />
    );
  }

  // ---- accessible sites + tree expansion ----
  const { data: orgSites } = await supabase
    .from("sites")
    .select("id, name, country, parent_site_id")
    .eq("org_id", profile.org_id)
    .order("name", { ascending: true });

  const accessibleSites = resolveAccessibleSites(
    (orgSites ?? []) as Site[],
    memberships.map((m) => ({
      site_id: m.site_id,
      include_children: m.include_children,
    })),
  );

  // ---- searchParams ----
  const view = parseView(sp.view);
  const date = parseDate(sp.date);
  const siteParam = pickFirst(sp.site); // "", "all", or a site_id
  const enabledKinds = parseEnabledKinds(sp);

  // Resolve which siteIds the aggregator should restrict to.
  let filterSiteIds: string[];
  if (siteParam === "all") {
    filterSiteIds = accessibleSites.map((s) => s.id);
  } else if (siteParam !== "" && accessibleSites.some((s) => s.id === siteParam)) {
    filterSiteIds = [siteParam];
  } else {
    filterSiteIds = currentSiteId ? [currentSiteId] : [];
  }

  // ---- aggregate ----
  const range = rangeFor(view, date);
  const events = await aggregatePlannerEvents({
    supabase,
    start: range.start,
    end: range.end,
    siteIds: filterSiteIds,
    kinds: enabledKinds,
  });

  // ---- build "+N more" link for month view that preserves filters ----
  const hrefForDay = (d: Date) => {
    const params = new URLSearchParams();
    params.set("view", "day");
    params.set("date", format(d, "yyyy-MM-dd"));
    if (siteParam) params.set("site", siteParam);
    for (const k of PLANNER_EVENT_KINDS) {
      if (!enabledKinds.includes(k)) params.set(k, "0");
    }
    return `/planner?${params.toString()}`;
  };

  const headerDateLabel =
    view === "month"
      ? format(date, "MMMM yyyy")
      : view === "week"
        ? `Week of ${format(rangeFor("week", date).start, "PP")}`
        : format(date, "PPPP");

  return (
    <TooltipProvider>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Module 5
            </p>
            <h1 className="flex items-center gap-1.5 text-2xl font-semibold">
              <CalendarDays className="h-6 w-6 text-brand" />
              Planner
              <InfoTooltip tip="planner_aggregation_rule" />
            </h1>
            <p className="text-sm text-muted-foreground">
              Read-only calendar of every dated event across modules. Click any
              chip to jump to its source.
              <InfoTooltip tip="planner_url_share" />
            </p>
          </div>
          <p className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium">
            {headerDateLabel}
          </p>
        </div>

        <PlannerFilters
          view={view}
          date={format(date, "yyyy-MM-dd")}
          siteParam={siteParam}
          enabledKinds={enabledKinds}
          sites={accessibleSites.map((s) => ({
            id: s.id,
            name: s.name,
            country: s.country,
          }))}
          currentSiteId={currentSiteId}
        />

        {view === "month" ? (
          <PlannerMonth events={events} date={date} hrefForDay={hrefForDay} />
        ) : view === "week" ? (
          <PlannerWeek events={events} date={date} />
        ) : (
          <PlannerDay events={events} date={date} />
        )}

        {events.length === 0 && view !== "day" ? (
          <p className="rounded-md border border-dashed bg-card/50 px-4 py-3 text-center text-xs text-muted-foreground">
            No events in this window. Try a different date or toggle on more
            event types.
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function EmptyShell({ title, message }: { title: string; message: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {message}
        <br />
        <Link href="/dashboard" className="mt-2 inline-block text-brand underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
