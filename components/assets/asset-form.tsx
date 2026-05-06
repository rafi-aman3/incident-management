"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ASSET_CONDITIONS,
  ASSET_CONDITION_LABEL,
  ASSET_KINDS,
  ASSET_KIND_LABEL,
  ASSET_STATUSES,
  type AssetCondition,
  type AssetKind,
  type AssetStatus,
} from "@/lib/documents/types";
import { DocumentSelectField } from "@/components/documents/document-select-field";
import {
  createAssetAction,
  type AssetCreateInput,
} from "@/lib/actions/assets";
import { updateAssetForForm } from "@/app/(app)/resources/assets/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

type SiteOption = { id: string; name: string };

export type AssetFormDefaults = {
  id?: string; // present = edit mode
  name?: string;
  kind?: AssetKind;
  site_id?: string;
  location?: string | null;
  condition?: AssetCondition;
  status?: AssetStatus;
  last_inspected_at?: string | null;
  next_pm_at?: string | null;
  sds_document_id?: string | null;
  sds_document_label?: string | null;
  notes?: string | null;
};

export function AssetForm({
  defaults,
  sites,
  cancelHref,
}: {
  defaults?: AssetFormDefaults;
  sites: SiteOption[];
  cancelHref: string;
}) {
  const isEdit = !!defaults?.id;
  // Both actions return ActionResult; cast widens to a shared signature for useActionState.
  const handler = (
    isEdit ? updateAssetForForm : createAssetAction
  ) as (
    prev: ActionResult | null,
    fd: FormData,
  ) => Promise<ActionResult>;
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    handler,
    null,
  );

  useEffect(() => {
    if (state && state.ok === false) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-5 rounded-lg border bg-card p-6">
      {isEdit && <input type="hidden" name="id" value={defaults!.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            name="name"
            id="name"
            required
            maxLength={160}
            defaultValue={defaults?.name ?? ""}
            placeholder="e.g. Hyster H40 — Bay 3"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="kind" className="text-sm font-medium">
            Kind <span className="text-destructive">*</span>
          </label>
          <select
            name="kind"
            id="kind"
            required
            defaultValue={defaults?.kind ?? "other"}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {ASSET_KINDS.map((k) => (
              <option key={k} value={k}>
                {ASSET_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="site_id" className="text-sm font-medium">
            Site <span className="text-destructive">*</span>
          </label>
          <select
            name="site_id"
            id="site_id"
            required
            defaultValue={defaults?.site_id ?? sites[0]?.id ?? ""}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {sites.length === 0 && <option value="">No site available</option>}
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="location" className="text-sm font-medium">
            Location
          </label>
          <input
            type="text"
            name="location"
            id="location"
            maxLength={160}
            defaultValue={defaults?.location ?? ""}
            placeholder="Bay 3, Aisle A"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="condition" className="text-sm font-medium">
            Condition
          </label>
          <select
            name="condition"
            id="condition"
            defaultValue={defaults?.condition ?? "good"}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {ASSET_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {ASSET_CONDITION_LABEL[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select
            name="status"
            id="status"
            defaultValue={defaults?.status ?? "active"}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {ASSET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "active" ? "Active" : "Retired"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="last_inspected_at" className="text-sm font-medium">
            Last inspected
          </label>
          <input
            type="date"
            name="last_inspected_at"
            id="last_inspected_at"
            defaultValue={
              defaults?.last_inspected_at
                ? defaults.last_inspected_at.slice(0, 10)
                : ""
            }
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="next_pm_at" className="text-sm font-medium">
            Next preventive maintenance
          </label>
          <input
            type="date"
            name="next_pm_at"
            id="next_pm_at"
            defaultValue={
              defaults?.next_pm_at ? defaults.next_pm_at.slice(0, 10) : ""
            }
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <DocumentSelectField
        name="sds_document_id"
        defaultValue={defaults?.sds_document_id ?? null}
        defaultLabel={defaults?.sds_document_label ?? null}
        defaultTypeFilter="sds"
        label="Linked SDS"
        placeholder="No SDS linked. Choose one from the library."
      />

      <div>
        <label htmlFor="notes" className="text-sm font-medium">
          Notes
        </label>
        <textarea
          name="notes"
          id="notes"
          rows={3}
          maxLength={2000}
          defaultValue={defaults?.notes ?? ""}
          placeholder="Anything an inspector should know — quirks, recent repairs, neighboring hazards."
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Link
          href={cancelHref}
          className="inline-flex items-center rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending || sites.length === 0}
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
        >
          {pending
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
              ? "Save changes"
              : "Create asset"}
        </button>
      </div>
    </form>
  );
}

// `AssetCreateInput` keeps this in lockstep with the server schema even
// though we don't reference it at runtime.
void (null as unknown as AssetCreateInput);
