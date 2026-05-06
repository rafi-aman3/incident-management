"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateAnnualHours } from "@/app/(app)/reports/osha-300a/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export function AnnualHoursForm({
  siteId,
  year,
  initialHours,
  readOnly,
}: {
  siteId: string;
  year: number;
  initialHours: number | null;
  readOnly: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    updateAnnualHours,
    null
  );
  const [value, setValue] = useState<string>(
    initialHours !== null ? String(initialHours) : ""
  );

  useEffect(() => {
    if (state?.ok) toast.success("Hours saved");
    if (state?.ok === false) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="year" value={year} />
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="annual-hours">Total hours worked in {year}</Label>
        <Input
          id="annual-hours"
          name="hours_worked"
          type="number"
          min={0}
          step={1}
          value={value}
          disabled={readOnly}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 120000"
        />
        <p className="text-[11px] text-muted-foreground">
          Sum of paid hours for all employees and supervised contractors. Enter
          a single number for the year — feed it into TRIR / DART / Severity Rate.
        </p>
      </div>
      {!readOnly && (
        <Button type="submit" disabled={isPending} className="shrink-0">
          {isPending ? "Saving…" : "Save"}
        </Button>
      )}
    </form>
  );
}
