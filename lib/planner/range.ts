/**
 * Date-range helpers for the planner's three views. Every range is a
 * half-open `[start, end]` pair (both Date instances) suitable for
 * `gte` / `lte` filters against ISO timestamp columns.
 *
 * Month range covers the leading Sunday → trailing Saturday so the
 * grid is always a clean 35- or 42-cell rectangle.
 *
 * Per plans/05-planner.md §B4.
 */

import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type PlannerView = "month" | "week" | "day";

export type DateRange = { start: Date; end: Date };

const WEEK_OPTS = { weekStartsOn: 0 as const }; // Sun → Sat

export function monthRange(date: Date): DateRange {
  return {
    start: startOfWeek(startOfMonth(date), WEEK_OPTS),
    end: endOfWeek(endOfMonth(date), WEEK_OPTS),
  };
}

export function weekRange(date: Date): DateRange {
  return {
    start: startOfWeek(date, WEEK_OPTS),
    end: endOfWeek(date, WEEK_OPTS),
  };
}

export function dayRange(date: Date): DateRange {
  return { start: startOfDay(date), end: endOfDay(date) };
}

export function rangeFor(view: PlannerView, date: Date): DateRange {
  if (view === "month") return monthRange(date);
  if (view === "week") return weekRange(date);
  return dayRange(date);
}
