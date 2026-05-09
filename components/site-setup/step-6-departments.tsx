"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStep6 } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import { StepFooter, StepFormError } from "./wizard-chrome";

type Department = { name: string; areas: string[] };

const STARTER_DEFAULTS: Department[] = [
  { name: "Production", areas: ["Line 1", "Line 2"] },
  { name: "Maintenance", areas: [] },
  { name: "Logistics", areas: ["Inbound", "Outbound"] },
];

export function Step6Departments({ initial }: { initial: Department[] }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep6,
    null
  );
  const [departments, setDepartments] = useState<Department[]>(
    initial.length > 0 ? initial : STARTER_DEFAULTS
  );

  const updateDept = (i: number, patch: Partial<Department>) => {
    setDepartments((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };
  const addDept = () => setDepartments((prev) => [...prev, { name: "", areas: [] }]);
  const removeDept = (i: number) =>
    setDepartments((prev) => prev.filter((_, idx) => idx !== i));
  const addArea = (i: number) =>
    updateDept(i, { areas: [...departments[i].areas, ""] });
  const updateArea = (i: number, j: number, value: string) =>
    updateDept(i, {
      areas: departments[i].areas.map((a, idx) => (idx === j ? value : a)),
    });
  const removeArea = (i: number, j: number) =>
    updateDept(i, { areas: departments[i].areas.filter((_, idx) => idx !== j) });

  const cleaned: Department[] = departments
    .map((d) => ({
      name: d.name.trim(),
      areas: d.areas.map((a) => a.trim()).filter(Boolean),
    }))
    .filter((d) => d.name.length > 0);

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        These populate the location dropdown when a worker reports an incident. Areas are optional —
        a department alone is fine if you don&apos;t track sub-locations.
      </p>

      <ul className="space-y-3">
        {departments.map((dept, i) => (
          <li key={i} className="rounded-md border p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor={`dept-${i}`}>Department</Label>
                <Input
                  id={`dept-${i}`}
                  value={dept.name}
                  onChange={(e) => updateDept(i, { name: e.target.value })}
                  placeholder="e.g. Production"
                />
              </div>
              <button
                type="button"
                onClick={() => removeDept(i)}
                aria-label={`Remove ${dept.name || `department ${i + 1}`}`}
                className="mt-7 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2 pl-2">
              <p className="text-xs font-medium text-muted-foreground">Areas</p>
              {dept.areas.length === 0 && (
                <p className="text-xs text-muted-foreground/80">No areas yet.</p>
              )}
              {dept.areas.map((area, j) => (
                <div key={j} className="flex items-center gap-2">
                  <Input
                    value={area}
                    onChange={(e) => updateArea(i, j, e.target.value)}
                    placeholder="e.g. Line 1"
                  />
                  <button
                    type="button"
                    onClick={() => removeArea(i, j)}
                    aria-label="Remove area"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addArea(i)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> Add area
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addDept}
        className="inline-flex items-center gap-1 rounded-md border border-dashed px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
      >
        <Plus className="h-4 w-4" /> Add department
      </button>

      <input type="hidden" name="departments_json" value={JSON.stringify(cleaned)} />

      <StepFormError
        message={state?.ok === false ? state.error : undefined}
        isPending={isPending}
      />

      <StepFooter prevHref="/admin/site-setup/hazards" isPending={isPending} primaryDisabled={cleaned.length === 0} />
    </form>
  );
}
