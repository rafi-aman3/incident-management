/**
 * App-level aggregator: 6 parallel queries (one per source kind), merged
 * in TS, sorted by date. Each query reads through the existing per-table
 * RLS — the caller-provided `siteIds` is an extra filter on top of that;
 * an empty list means "no site filter", letting RLS restrict to whichever
 * sites the viewer can read.
 *
 * Per plans/05-planner.md §B3 (resolved Q1: app-level over Postgres union).
 */

import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  type PlannerEvent,
  type PlannerEventKind,
  PLANNER_EVENT_KINDS,
} from "@/lib/planner/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type Severity = Database["public"]["Enums"]["severity"];

export type AggregateInput = {
  supabase: SupabaseServerClient;
  start: Date;
  end: Date;
  /** Empty list = no extra site filter (RLS still applies). */
  siteIds: string[];
  /** Undefined / empty = include every kind. */
  kinds?: PlannerEventKind[];
};

export async function aggregatePlannerEvents(
  input: AggregateInput,
): Promise<PlannerEvent[]> {
  const wanted = new Set<PlannerEventKind>(
    input.kinds && input.kinds.length > 0 ? input.kinds : PLANNER_EVENT_KINDS,
  );

  const startIso = input.start.toISOString();
  const endIso = input.end.toISOString();
  const nowIso = new Date().toISOString();

  const tasks: Array<Promise<PlannerEvent[]>> = [];

  if (wanted.has("incident")) {
    tasks.push(fetchIncidents(input.supabase, startIso, endIso, input.siteIds));
  }
  if (wanted.has("inspection_started")) {
    tasks.push(fetchInspectionsStarted(input.supabase, startIso, endIso, input.siteIds));
  }
  if (wanted.has("inspection_completed")) {
    tasks.push(fetchInspectionsCompleted(input.supabase, startIso, endIso, input.siteIds));
  }
  if (wanted.has("capa_due")) {
    tasks.push(fetchCapaDue(input.supabase, startIso, endIso, input.siteIds, nowIso));
  }
  if (wanted.has("asset_pm_due")) {
    tasks.push(fetchAssetPmDue(input.supabase, startIso, endIso, input.siteIds, nowIso));
  }
  if (wanted.has("investigation_due")) {
    tasks.push(fetchInvestigationDue(input.supabase, startIso, endIso, input.siteIds, nowIso));
  }
  if (wanted.has("regulatory_deadline")) {
    tasks.push(fetchRegulatoryDeadlines(input.supabase, startIso, endIso, input.siteIds));
  }

  const grouped = await Promise.all(tasks);
  const merged = grouped.flat();

  merged.sort((a, b) => a.date.localeCompare(b.date));
  return merged;
}

// ---------------------------------------------------------------------------
// Per-source fetchers. Each returns an empty array on error rather than
// throwing — one source failing should not blank the whole calendar.
// ---------------------------------------------------------------------------

type SiteRef = { id: string; name: string | null };
const siteOf = (ref: SiteRef | SiteRef[] | null | undefined): SiteRef | null =>
  Array.isArray(ref) ? (ref[0] ?? null) : (ref ?? null);

async function fetchIncidents(
  supabase: SupabaseServerClient,
  startIso: string,
  endIso: string,
  siteIds: string[],
): Promise<PlannerEvent[]> {
  let q = supabase
    .from("incidents")
    .select("id, ref_code, title, severity, occurred_at, site_id, site:sites(id, name)")
    .is("deleted_at", null)
    .gte("occurred_at", startIso)
    .lte("occurred_at", endIso);

  if (siteIds.length > 0) q = q.in("site_id", siteIds);

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row) => {
    const site = siteOf(row.site as SiteRef | SiteRef[] | null);
    const refLabel = row.ref_code ? `${row.ref_code} · ` : "";
    return {
      id: `incident:${row.id}`,
      kind: "incident" as const,
      date: row.occurred_at,
      title: `${refLabel}${row.title}`,
      href: `/incidents/${row.id}`,
      site_id: row.site_id,
      site_name: site?.name ?? null,
      severity: (row.severity as Severity | null) ?? null,
    };
  });
}

async function fetchInspectionsStarted(
  supabase: SupabaseServerClient,
  startIso: string,
  endIso: string,
  siteIds: string[],
): Promise<PlannerEvent[]> {
  let q = supabase
    .from("inspections")
    .select("id, ref_code, title, started_at, site_id, site:sites(id, name)")
    .is("deleted_at", null)
    .gte("started_at", startIso)
    .lte("started_at", endIso);

  if (siteIds.length > 0) q = q.in("site_id", siteIds);

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row) => {
    const site = siteOf(row.site as SiteRef | SiteRef[] | null);
    return {
      id: `inspection_started:${row.id}`,
      kind: "inspection_started" as const,
      date: row.started_at,
      title: `${row.ref_code} · ${row.title}`,
      href: `/inspections/${row.id}`,
      site_id: row.site_id,
      site_name: site?.name ?? null,
    };
  });
}

async function fetchInspectionsCompleted(
  supabase: SupabaseServerClient,
  startIso: string,
  endIso: string,
  siteIds: string[],
): Promise<PlannerEvent[]> {
  let q = supabase
    .from("inspections")
    .select("id, ref_code, title, completed_at, is_failed, site_id, site:sites(id, name)")
    .is("deleted_at", null)
    .not("completed_at", "is", null)
    .gte("completed_at", startIso)
    .lte("completed_at", endIso);

  if (siteIds.length > 0) q = q.in("site_id", siteIds);

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row) => {
    const site = siteOf(row.site as SiteRef | SiteRef[] | null);
    const failed = !!row.is_failed;
    return {
      id: `inspection_completed:${row.id}`,
      kind: "inspection_completed" as const,
      date: row.completed_at!,
      title: `${row.ref_code} · ${row.title}${failed ? " (failed)" : ""}`,
      href: `/inspections/${row.id}`,
      site_id: row.site_id,
      site_name: site?.name ?? null,
      is_failed: failed,
    };
  });
}

async function fetchCapaDue(
  supabase: SupabaseServerClient,
  startIso: string,
  endIso: string,
  siteIds: string[],
  nowIso: string,
): Promise<PlannerEvent[]> {
  let q = supabase
    .from("capas")
    .select("id, ref_code, title, due_date, status, site_id, site:sites(id, name)")
    .is("deleted_at", null)
    .not("due_date", "is", null)
    .not("status", "in", "(verified,closed)")
    .gte("due_date", startIso)
    .lte("due_date", endIso);

  if (siteIds.length > 0) q = q.in("site_id", siteIds);

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row) => {
    const site = siteOf(row.site as SiteRef | SiteRef[] | null);
    const refLabel = row.ref_code ? `${row.ref_code} · ` : "";
    return {
      id: `capa_due:${row.id}`,
      kind: "capa_due" as const,
      date: row.due_date!,
      title: `${refLabel}${row.title}`,
      href: `/capa/${row.id}`,
      site_id: row.site_id,
      site_name: site?.name ?? null,
      is_overdue: row.due_date! < nowIso,
    };
  });
}

async function fetchAssetPmDue(
  supabase: SupabaseServerClient,
  startIso: string,
  endIso: string,
  siteIds: string[],
  nowIso: string,
): Promise<PlannerEvent[]> {
  let q = supabase
    .from("assets")
    .select("id, name, kind, next_pm_at, status, site_id, site:sites(id, name)")
    .is("deleted_at", null)
    .eq("status", "active")
    .not("next_pm_at", "is", null)
    .gte("next_pm_at", startIso)
    .lte("next_pm_at", endIso);

  if (siteIds.length > 0) q = q.in("site_id", siteIds);

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row) => {
    const site = siteOf(row.site as SiteRef | SiteRef[] | null);
    return {
      id: `asset_pm_due:${row.id}`,
      kind: "asset_pm_due" as const,
      date: row.next_pm_at!,
      title: `${row.kind} · ${row.name}`,
      href: `/resources/assets/${row.id}`,
      site_id: row.site_id,
      site_name: site?.name ?? null,
      is_overdue: row.next_pm_at! < nowIso,
    };
  });
}

async function fetchInvestigationDue(
  supabase: SupabaseServerClient,
  startIso: string,
  endIso: string,
  siteIds: string[],
  nowIso: string,
): Promise<PlannerEvent[]> {
  let q = supabase
    .from("investigations")
    .select(
      "id, ref_code, due_date, status, site_id, incident:incidents(title), site:sites(id, name)",
    )
    .is("deleted_at", null)
    .not("due_date", "is", null)
    .neq("status", "closed")
    .gte("due_date", startIso)
    .lte("due_date", endIso);

  if (siteIds.length > 0) q = q.in("site_id", siteIds);

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row) => {
    const site = siteOf(row.site as SiteRef | SiteRef[] | null);
    const incident = Array.isArray(row.incident) ? row.incident[0] : row.incident;
    const refLabel = row.ref_code ? `${row.ref_code} · ` : "";
    const title = incident?.title ?? "Investigation";
    return {
      id: `investigation_due:${row.id}`,
      kind: "investigation_due" as const,
      date: row.due_date!,
      title: `${refLabel}${title}`,
      href: `/investigations/${row.id}`,
      site_id: row.site_id,
      site_name: site?.name ?? null,
      is_overdue: row.due_date! < nowIso,
    };
  });
}

async function fetchRegulatoryDeadlines(
  supabase: SupabaseServerClient,
  startIso: string,
  endIso: string,
  siteIds: string[],
): Promise<PlannerEvent[]> {
  let q = supabase
    .from("notifications")
    .select("id, title, deadline_at, incident_id, capa_id, site_id, site:sites(id, name)")
    .not("deadline_at", "is", null)
    .is("resolved_at", null)
    .gte("deadline_at", startIso)
    .lte("deadline_at", endIso);

  if (siteIds.length > 0) q = q.in("site_id", siteIds);

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row) => {
    const site = siteOf(row.site as SiteRef | SiteRef[] | null);
    const href = row.incident_id
      ? `/incidents/${row.incident_id}`
      : row.capa_id
        ? `/capa/${row.capa_id}`
        : "/dashboard";
    return {
      id: `regulatory_deadline:${row.id}`,
      kind: "regulatory_deadline" as const,
      date: row.deadline_at!,
      title: row.title,
      href,
      site_id: row.site_id,
      site_name: site?.name ?? null,
    };
  });
}
