"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MapPinned, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/info-tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

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
    setFieldErrors({});
    const selections = buildSelections();
    if (selections.length === 0) {
      setFieldErrors({ selections: ["Pick at least one site"] });
      toast.error("Pick at least one site");
      return;
    }
    if (scheduleKind === "custom" && !cron.trim()) {
      setFieldErrors({ schedule_cron: ["Required for custom schedule"] });
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
        setFieldErrors(res.fieldErrors ?? {});
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
          <ul
            className="mt-3 divide-y rounded-md border"
            aria-describedby={
              fieldErrors.selections ? "selections-error" : undefined
            }
          >
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
        {fieldErrors.selections && (
          <p id="selections-error" className="mt-2 text-xs text-destructive">
            {fieldErrors.selections.join(" ")}
          </p>
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
                aria-invalid={Boolean(fieldErrors.start_time_local)}
                aria-describedby={
                  fieldErrors.start_time_local
                    ? "start-time-error"
                    : undefined
                }
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Site-local timezone (24-hour).
              </p>
              {fieldErrors.start_time_local && (
                <p
                  id="start-time-error"
                  className="mt-1 text-[11px] text-destructive"
                >
                  {fieldErrors.start_time_local.join(" ")}
                </p>
              )}
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
                aria-invalid={Boolean(fieldErrors.schedule_cron)}
                aria-describedby={
                  fieldErrors.schedule_cron ? "cron-error" : undefined
                }
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Standard 5-field cron (minute hour day month weekday).
              </p>
              {fieldErrors.schedule_cron && (
                <p id="cron-error" className="mt-1 text-[11px] text-destructive">
                  {fieldErrors.schedule_cron.join(" ")}
                </p>
              )}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs italic text-muted-foreground">
          Schedules are stored for future automation; v1 inspections are
          started manually from the{" "}
          <span className="font-medium not-italic">Inspections</span> page.
        </p>
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
            <MapPinned aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Active assignments</h2>
          </header>
          <table className="w-full text-sm">
            <caption className="sr-only">
              Active template assignments for {templateName}
            </caption>
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Site
                </th>
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Schedule
                </th>
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Pinned version
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {existing.map((e) => (
                <tr key={e.id}>
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    {e.site_name}
                    {e.include_children && (
                      <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                        + children
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {e.schedule_kind === "on_demand"
                      ? "On demand"
                      : `${e.schedule_kind}${
                          e.start_time_local
                            ? ` @ ${e.start_time_local.slice(0, 5)}`
                            : ""
                        }${e.schedule_cron ? ` (${e.schedule_cron})` : ""}`}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                    {e.template_version_number
                      ? `v${e.template_version_number}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          disabled={pending}
                          aria-label={`Remove assignment from ${e.site_name}`}
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Remove assignment from {e.site_name}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            <span className="font-medium text-foreground">
                              {templateName}
                            </span>{" "}
                            will no longer be available to start at{" "}
                            <span className="font-medium text-foreground">
                              {e.site_name}
                            </span>
                            . Inspections already in progress against the
                            pinned version stay running and unaffected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleUnassign(e.id)}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
