"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MapPinned, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/info-tooltip";
import {
  assignTemplate,
  unassignTemplate,
} from "@/app/(app)/templates/[id]/assign/actions";
import type { TemplateScheduleKind } from "@/lib/templates/types";

type Site = {
  id: string;
  name: string;
  country: "US" | "GB";
};

export type ExistingAssignment = {
  id: string;
  site_id: string;
  site_name: string;
  include_children: boolean;
  schedule_kind: TemplateScheduleKind;
  schedule_cron: string | null;
  start_time_local: string | null;
  template_version_number: number | null;
};

const KIND_OPTIONS: {
  value: TemplateScheduleKind;
  label: string;
  hint: string;
}[] = [
  { value: "daily", label: "Daily", hint: "Every day at the local time below" },
  { value: "weekly", label: "Weekly", hint: "Once per week (day/time managed by ops in v2)" },
  { value: "monthly", label: "Monthly", hint: "Once per month at the local time below" },
  { value: "custom", label: "Custom", hint: "Cron expression (advanced)" },
  { value: "on_demand", label: "On demand", hint: "No schedule — workers run when needed" },
];

export function TemplateAssignForm({
  templateId,
  templateName,
  sites,
  existing,
  canSubmit,
}: {
  templateId: string;
  templateName: string;
  sites: Site[];
  existing: ExistingAssignment[];
  canSubmit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initialSelected = new Set<string>(
    existing.map((e) => e.site_id)
  );
  const initialIncludeChildren = Object.fromEntries(
    existing.map((e) => [e.site_id, e.include_children] as const)
  );

  const [allSites, setAllSites] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [includeChildren, setIncludeChildren] =
    useState<Record<string, boolean>>(initialIncludeChildren);
  const [scheduleKind, setScheduleKind] = useState<TemplateScheduleKind>(
    existing[0]?.schedule_kind ?? "on_demand"
  );
  const [startTime, setStartTime] = useState<string>(
    existing[0]?.start_time_local?.slice(0, 5) ?? "06:00"
  );
  const [cron, setCron] = useState<string>(existing[0]?.schedule_cron ?? "");

  function toggleSite(siteId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  }

  function setIncludeChildrenFor(siteId: string, value: boolean) {
    setIncludeChildren((prev) => ({ ...prev, [siteId]: value }));
  }

  function buildSelections(): Array<{ site_id: string; include_children: boolean }> {
    if (allSites) {
      return sites.map((s) => ({
        site_id: s.id,
        include_children: includeChildren[s.id] ?? false,
      }));
    }
    return [...selected].map((id) => ({
      site_id: id,
      include_children: includeChildren[id] ?? false,
    }));
  }

  function handleSubmit() {
    const selections = buildSelections();
    if (selections.length === 0) {
      toast.error("Pick at least one site");
      return;
    }
    if (scheduleKind === "custom" && !cron.trim()) {
      toast.error("Custom schedule needs a cron expression");
      return;
    }
    startTransition(async () => {
      const res = await assignTemplate({
        template_id: templateId,
        schedule_kind: scheduleKind,
        schedule_cron: scheduleKind === "custom" ? cron : null,
        start_time_local:
          scheduleKind === "on_demand" ? null : startTime,
        selections,
      });
      if (res.ok) {
        toast.success(
          `Assigned to ${res.data?.count ?? selections.length} site${
            (res.data?.count ?? 1) === 1 ? "" : "s"
          }`
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleUnassign(assignmentId: string) {
    startTransition(async () => {
      const res = await unassignTemplate(assignmentId);
      if (res.ok) {
        toast.success("Removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Pick sites</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Assigning <span className="font-medium">{templateName}</span> pins the
          currently-published version onto each site. Existing inspections in
          progress against an older version will keep running on that version
          (snapshot rule).
        </p>

        <div className="mt-4 flex items-start gap-2 rounded-md border p-3">
          <input
            type="checkbox"
            id="all-sites"
            checked={allSites}
            onChange={(e) => setAllSites(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border"
          />
          <label htmlFor="all-sites" className="flex-1 text-sm">
            <span className="flex items-center font-medium">
              Assign to every site I manage
              <InfoTooltip tip="all_sites_assignment" />
            </span>
            <span className="block text-xs text-muted-foreground">
              {sites.length} site{sites.length === 1 ? "" : "s"} in scope:{" "}
              {sites
                .slice(0, 3)
                .map((s) => s.name)
                .join(", ")}
              {sites.length > 3 ? "…" : ""}
            </span>
          </label>
        </div>

        {!allSites && (
          <ul className="mt-3 divide-y rounded-md border">
            {sites.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">
                No sites available. You need template:assign on at least one
                site.
              </li>
            )}
            {sites.map((site) => {
              const isSelected = selected.has(site.id);
              const isIncludeChildren = includeChildren[site.id] ?? false;
              return (
                <li key={site.id} className="px-4 py-3">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSite(site.id)}
                      className="mt-0.5 h-4 w-4 rounded border"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {site.name}{" "}
                        <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                          {site.country}
                        </span>
                      </p>
                      {isSelected && (
                        <label className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={isIncludeChildren}
                            onChange={(e) =>
                              setIncludeChildrenFor(site.id, e.target.checked)
                            }
                            className="h-3 w-3 rounded border"
                          />
                          Include child sites
                        </label>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Schedule</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Frequency
            </label>
            <select
              value={scheduleKind}
              onChange={(e) =>
                setScheduleKind(e.target.value as TemplateScheduleKind)
              }
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {KIND_OPTIONS.find((k) => k.value === scheduleKind)?.hint}
            </p>
          </div>

          {scheduleKind !== "on_demand" && scheduleKind !== "custom" && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Local start time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Site-local timezone (24-hour). The runs cron schedules new
                inspections at this hour each cycle.
              </p>
            </div>
          )}

          {scheduleKind === "custom" && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cron expression
              </label>
              <input
                type="text"
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                placeholder="0 6 * * 1"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Standard 5-field cron (minute hour day month weekday). Stored
                as-is; runs cron lands in v2.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-md border-l-4 border-warning/40 bg-warning/5 p-3 text-xs">
          <strong>Note:</strong> the recurring-inspection auto-creation cron is
          deferred — for now the schedule fields are stored on the assignment
          row but inspections must be started manually via the Inspections
          page.
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !canSubmit}
        >
          <CheckCircle2 className="mr-1 h-3 w-3" />
          {pending ? "Saving..." : "Save assignment"}
        </Button>
      </div>

      {existing.length > 0 && (
        <div className="rounded-lg border bg-card">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <MapPinned className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Active assignments</h2>
          </header>
          <ul className="divide-y">
            {existing.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{e.site_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.schedule_kind === "on_demand"
                      ? "On demand"
                      : `${e.schedule_kind}${
                          e.start_time_local
                            ? ` @ ${e.start_time_local.slice(0, 5)}`
                            : ""
                        }${e.schedule_cron ? ` (${e.schedule_cron})` : ""}`}
                    {e.include_children ? " · includes children" : ""}
                    {e.template_version_number
                      ? ` · pinned to v${e.template_version_number}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnassign(e.id)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
