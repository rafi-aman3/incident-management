"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  setAnnualHoursAction,
  deleteAnnualHoursAction,
} from "@/app/(app)/admin/sites/[id]/hours-actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export type AnnualHoursRow = {
  year: number;
  hours_worked: number;
};

/**
 * Multi-year hours editor for the admin Site detail tab. Different shape
 * than the OSHA 300A `<AnnualHoursForm>` (which is single-year) but shares
 * the same `setAnnualHoursAction` server action and `site_annual_hours`
 * table — edits round-trip to both surfaces.
 */
export function AnnualHoursEditor({
  siteId,
  initial,
  readOnly,
}: {
  siteId: string;
  initial: AnnualHoursRow[];
  readOnly: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Annual hours worked
          </p>
          <h2 className="text-base font-semibold">
            One row per year — feeds TRIR / DART / Severity Rate
          </h2>
        </div>
        {!readOnly && <AddYearButton siteId={siteId} existingYears={initial.map((r) => r.year)} />}
      </div>
      {initial.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          No years recorded yet. Add a year to start computing recordable rates.
        </div>
      ) : (
        <ul className="divide-y">
          {initial
            .slice()
            .sort((a, b) => b.year - a.year)
            .map((row) => (
              <YearRow
                key={row.year}
                siteId={siteId}
                row={row}
                readOnly={readOnly}
              />
            ))}
        </ul>
      )}
    </div>
  );
}

function YearRow({
  siteId,
  row,
  readOnly,
}: {
  siteId: string;
  row: AnnualHoursRow;
  readOnly: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    setAnnualHoursAction,
    null,
  );
  const [value, setValue] = useState(String(row.hours_worked));

  useEffect(() => {
    if (state?.ok) toast.success(`Saved ${row.year}`);
    if (state?.ok === false) toast.error(state.error);
  }, [state, row.year]);

  return (
    <li className="px-4 py-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="site_id" value={siteId} />
        <input type="hidden" name="year" value={row.year} />
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Year</Label>
          <p className="font-mono text-sm tabular-nums">{row.year}</p>
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor={`hours-${row.year}`} className="text-[11px] text-muted-foreground">
            Hours worked
          </Label>
          <Input
            id={`hours-${row.year}`}
            name="hours_worked"
            type="number"
            min={0}
            step={1}
            value={value}
            disabled={readOnly}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending} size="sm">
              {isPending ? "Saving…" : "Save"}
            </Button>
            <DeleteYearButton siteId={siteId} year={row.year} />
          </div>
        )}
      </form>
    </li>
  );
}

function AddYearButton({
  siteId,
  existingYears,
}: {
  siteId: string;
  existingYears: number[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    setAnnualHoursAction,
    null,
  );
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [hours, setHours] = useState("");

  useEffect(() => {
    if (state?.ok) {
      toast.success(`Added ${year}`);
      setOpen(false);
      setHours("");
    }
    if (state?.ok === false) toast.error(state.error);
  }, [state, year]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
        >
          <Plus className="h-3 w-3" /> Add year
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Add annual hours</AlertDialogTitle>
          <AlertDialogDescription>
            Enter the calendar year and total paid hours for all employees +
            supervised contractors.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="site_id" value={siteId} />
          <div className="space-y-1.5">
            <Label htmlFor="add-year" className="text-xs">Year</Label>
            <Input
              id="add-year"
              name="year"
              type="number"
              min={2000}
              max={2100}
              step={1}
              required
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
            {existingYears.includes(year) && (
              <p className="text-xs text-warning-foreground dark:text-warning">
                {year} already exists — saving overwrites.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-hours" className="text-xs">Hours worked</Label>
            <Input
              id="add-hours"
              name="hours_worked"
              type="number"
              min={0}
              step={1}
              required
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 240000"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteYearButton({ siteId, year }: { siteId: string; year: number }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    deleteAnnualHoursAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) toast.success(`Removed ${year}`);
    if (state?.ok === false) toast.error(state.error);
  }, [state, year]);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label={`Remove ${year}`}
          className="rounded-md border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
          disabled={isPending}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {year}?</AlertDialogTitle>
          <AlertDialogDescription>
            The {year} row will be removed. OSHA 300A for {year} will show as
            "no hours recorded" until you add it back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="year" value={year} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={isPending}>
              {isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
