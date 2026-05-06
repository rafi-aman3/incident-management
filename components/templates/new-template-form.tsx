"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { INDUSTRY_VALUES, industryLabel } from "@/lib/templates/industry-map";
import type { IndustryEnum } from "@/lib/templates/industry-map";
import { createTemplateForForm } from "@/app/(app)/templates/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export function NewTemplateForm({
  defaultIndustry,
}: {
  defaultIndustry: IndustryEnum;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createTemplateForForm,
    null
  );

  useEffect(() => {
    if (state && state.ok === false) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-4 rounded-lg border bg-card p-6">
      <div>
        <label htmlFor="name" className="text-sm font-medium">
          Name <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          name="name"
          id="name"
          required
          maxLength={200}
          placeholder="e.g. Forklift Pre-Use Inspection"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="industry" className="text-sm font-medium">
          Industry <span className="text-destructive">*</span>
        </label>
        <select
          name="industry"
          id="industry"
          required
          defaultValue={defaultIndustry}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          {INDUSTRY_VALUES.map((ind) => (
            <option key={ind} value={ind}>
              {industryLabel(ind)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          name="description"
          id="description"
          rows={3}
          maxLength={2000}
          placeholder="What this template covers, who fills it out, and when."
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Link
          href="/templates"
          className="inline-flex items-center rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Creating..." : "Create & open editor"}
        </button>
      </div>
    </form>
  );
}
