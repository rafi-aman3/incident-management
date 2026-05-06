"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RiskMatrix } from "@/components/risk-matrix/risk-matrix";
import { BodyMap, type BodyPart } from "@/components/body-map/body-map";
import { FileUpload } from "@/components/incidents/wizard/file-upload";
import { LinkedDocumentsSection } from "@/components/documents/linked-documents-section";
import { AssetTypeaheadField } from "@/components/assets/asset-typeahead-field";
import { saveStep2 } from "@/app/(app)/incidents/new/[step]/actions";
import { PPE_OPTIONS, type IncidentType } from "@/lib/incidents/types";
import {
  RIDDOR_SPECIFIED_INJURIES,
  RIDDOR_SPECIFIED_INJURY_LABELS,
} from "@/lib/constants/riddor";
import type { ActionResult } from "@/lib/incidents/schemas";
import type { MatrixCoord } from "@/lib/workflow/severity";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/info-tooltip";
import { SandboxBanner } from "./wizard-progress";

type InjuredDraft = {
  name: string;
  body_parts: BodyPart[];
  treatment: "none" | "first_aid" | "medical" | "hospitalization";
  fatality: boolean;
  hospitalized: boolean;
  riddor_specified_injury: string | null;
};
type WitnessDraft = { name: string; contact: string; statement: string };

export type InitialInjured = {
  name?: string | null;
  body_parts?: BodyPart[] | null;
  treatment?: string | null;
  fatality?: boolean | null;
  hospitalized?: boolean | null;
  riddor_specified_injury?: string | null;
};
export type InitialWitness = {
  name?: string | null;
  contact?: string | null;
  statement?: string | null;
};

type Props = {
  incidentId: string;
  orgId: string;
  siteId: string | null;
  type: IncidentType;
  isSandbox: boolean;
  isUKSite: boolean;
  initial: {
    injured_persons?: InitialInjured[];
    witnesses?: InitialWitness[];
    ppe_worn?: string[];
    substance?: string | null;
    quantity_value?: number | null;
    quantity_unit?: string | null;
    equipment?: string | null;
    equipment_asset_id?: string | null;
    equipment_asset_label?: string | null;
    dangerous_occurrence_kind?: string | null;
    attachments?: { id: string; file_name: string; storage_path: string }[];
  };
};

export function Step2Details(props: Props) {
  const { incidentId, orgId, siteId, type, isSandbox, isUKSite, initial } = props;

  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep2,
    null
  );
  const [matrix, setMatrix] = useState<{ likelihood: MatrixCoord | null; consequence: MatrixCoord | null }>({
    likelihood: null,
    consequence: null,
  });
  const [injured, setInjured] = useState<InjuredDraft[]>(
    (initial.injured_persons ?? []).map((p) => ({
      name: p.name ?? "",
      body_parts: (p.body_parts ?? []) as BodyPart[],
      treatment: ((p.treatment ?? "none") as InjuredDraft["treatment"]),
      fatality: Boolean(p.fatality),
      hospitalized: Boolean(p.hospitalized),
      riddor_specified_injury: p.riddor_specified_injury ?? null,
    }))
  );
  const [witnesses, setWitnesses] = useState<WitnessDraft[]>(
    (initial.witnesses ?? []).map((w) => ({
      name: w.name ?? "",
      contact: w.contact ?? "",
      statement: w.statement ?? "",
    }))
  );
  const [ppe, setPpe] = useState<string[]>(initial.ppe_worn ?? []);

  const showInjuredSection = type === "injury" || type === "illness";
  const showPpe = type === "injury" || type === "illness";
  const showSubstance = type === "environmental_release";
  const showEquipment = type === "property_damage" || type === "dangerous_occurrence";
  const showDangerousOccKind = type === "dangerous_occurrence";
  const showAssetTypeahead =
    type === "property_damage" || type === "unsafe_condition" || type === "dangerous_occurrence";

  const togglePpe = (item: string) =>
    setPpe((prev) => (prev.includes(item) ? prev.filter((p) => p !== item) : [...prev, item]));

  return (
    <TooltipProvider>
    <form action={formAction} className="space-y-6">
      {isSandbox && <SandboxBanner />}

      <input type="hidden" name="incident_id" value={incidentId} />
      <input type="hidden" name="injured_persons_json" value={JSON.stringify(injured)} />
      <input type="hidden" name="witnesses_json" value={JSON.stringify(witnesses)} />
      <input type="hidden" name="ppe_worn_json" value={JSON.stringify(ppe)} />

      {/* Risk matrix — universal */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Risk classification</h2>
        <p className="text-sm text-muted-foreground">
          Pick how likely this is to happen and how bad the consequence could be. The system maps it to S1–S5.
        </p>
        <RiskMatrix
          value={matrix}
          onChange={(v) => setMatrix(v)}
        />
        <input type="hidden" name="likelihood" value={matrix.likelihood ?? ""} />
        <input type="hidden" name="consequence" value={matrix.consequence ?? ""} />
      </section>

      {/* Injured persons (injury / illness) */}
      {showInjuredSection && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {type === "injury" ? "Injured person" : "Affected person"}
              {injured.length > 1 ? "s" : ""}
            </h2>
            <button
              type="button"
              onClick={() =>
                setInjured((prev) => [
                  ...prev,
                  {
                    name: "",
                    body_parts: [],
                    treatment: "none",
                    fatality: false,
                    hospitalized: false,
                    riddor_specified_injury: null,
                  },
                ])
              }
              className="inline-flex items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              <Plus className="h-3 w-3" /> Add person
            </button>
          </div>
          {injured.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No one entered yet. Click &quot;Add person&quot; to record who was hurt.
            </p>
          )}
          <ul className="space-y-4">
            {injured.map((p, i) => (
              <li key={i} className="space-y-3 rounded-md border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`person-${i}-name`}>Name</Label>
                    <Input
                      id={`person-${i}-name`}
                      value={p.name}
                      onChange={(e) =>
                        setInjured((prev) =>
                          prev.map((q, idx) => (idx === i ? { ...q, name: e.target.value } : q))
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setInjured((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove person"
                    className="mt-7 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {type === "injury" && (
                  <div className="space-y-2">
                    <Label className="flex items-center">
                      Body parts affected
                      <InfoTooltip tip="body_map_guidance" />
                    </Label>
                    <BodyMap
                      value={p.body_parts}
                      onChange={(parts) =>
                        setInjured((prev) =>
                          prev.map((q, idx) => (idx === i ? { ...q, body_parts: parts } : q))
                        )
                      }
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`person-${i}-treatment`}>Treatment</Label>
                    <Select
                      value={p.treatment}
                      onValueChange={(v) =>
                        setInjured((prev) =>
                          prev.map((q, idx) =>
                            idx === i ? { ...q, treatment: v as InjuredDraft["treatment"] } : q
                          )
                        )
                      }
                    >
                      <SelectTrigger id={`person-${i}-treatment`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="first_aid">First aid only</SelectItem>
                        <SelectItem value="medical">Medical treatment</SelectItem>
                        <SelectItem value="hospitalization">Hospitalization</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isUKSite && type === "injury" && (
                    <div className="space-y-2">
                      <Label htmlFor={`person-${i}-rsi`}>RIDDOR specified injury</Label>
                      <Select
                        value={p.riddor_specified_injury ?? ""}
                        onValueChange={(v) =>
                          setInjured((prev) =>
                            prev.map((q, idx) =>
                              idx === i ? { ...q, riddor_specified_injury: v || null } : q
                            )
                          )
                        }
                      >
                        <SelectTrigger id={`person-${i}-rsi`}>
                          <SelectValue placeholder="— none —" />
                        </SelectTrigger>
                        <SelectContent>
                          {RIDDOR_SPECIFIED_INJURIES.map((rsi) => (
                            <SelectItem key={rsi} value={rsi}>
                              {RIDDOR_SPECIFIED_INJURY_LABELS[rsi]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={p.hospitalized}
                      onCheckedChange={(c) =>
                        setInjured((prev) =>
                          prev.map((q, idx) =>
                            idx === i ? { ...q, hospitalized: Boolean(c) } : q
                          )
                        )
                      }
                    />
                    Hospitalized
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={p.fatality}
                      onCheckedChange={(c) =>
                        setInjured((prev) =>
                          prev.map((q, idx) =>
                            idx === i ? { ...q, fatality: Boolean(c) } : q
                          )
                        )
                      }
                    />
                    Fatality
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* PPE worn */}
      {showPpe && (
        <section className="space-y-2">
          <Label>PPE worn at the time</Label>
          <div className="flex flex-wrap gap-2">
            {PPE_OPTIONS.map((opt) => {
              const on = ppe.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => togglePpe(opt)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Substance / quantity */}
      {showSubstance && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Substance released</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="substance">Substance</Label>
              <Input id="substance" name="substance" defaultValue={initial.substance ?? ""} placeholder="e.g. Coolant, ammonia, diesel" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="quantity_value">Quantity</Label>
                <Input id="quantity_value" name="quantity_value" type="number" min="0" step="any" defaultValue={initial.quantity_value ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity_unit">Unit</Label>
                <Input id="quantity_unit" name="quantity_unit" defaultValue={initial.quantity_unit ?? ""} placeholder="L / kg" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Equipment */}
      {showEquipment && (
        <section className="space-y-2">
          <Label htmlFor="equipment">Equipment involved</Label>
          <Input id="equipment" name="equipment" defaultValue={initial.equipment ?? ""} placeholder="e.g. Forklift #4, Press 7" />
        </section>
      )}

      {/* Phase 4: optional FK to a registered asset */}
      {showAssetTypeahead && (
        <section className="space-y-2">
          <AssetTypeaheadField
            name="equipment_asset_id"
            siteId={siteId}
            defaultValue={initial.equipment_asset_id ?? null}
            defaultLabel={initial.equipment_asset_label ?? null}
          />
        </section>
      )}

      {/* Dangerous occurrence kind */}
      {showDangerousOccKind && (
        <section className="space-y-2">
          <Label htmlFor="dangerous_occurrence_kind">RIDDOR Schedule 2 kind</Label>
          <Input
            id="dangerous_occurrence_kind"
            name="dangerous_occurrence_kind"
            defaultValue={initial.dangerous_occurrence_kind ?? ""}
            placeholder="e.g. Lifting equipment failure, pressure system failure"
          />
        </section>
      )}

      {/* Attachments — direct upload (legacy path) + library link picker */}
      <section className="space-y-3">
        <FileUpload incidentId={incidentId} initial={initial.attachments ?? []} />
        <LinkedDocumentsSection
          parentType="incident"
          parentId={incidentId}
          orgId={orgId}
          defaultLinkRole="attachment"
          defaultTypeFilter={
            type === "property_damage" || type === "unsafe_condition"
              ? "sds"
              : "evidence"
          }
          title="Or link from the library"
          emptyHint="Re-use a SDS, SOP, or training cert from the library instead of re-uploading."
        />
      </section>

      {/* Witnesses */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Witnesses (optional)</h2>
          <button
            type="button"
            onClick={() => setWitnesses((prev) => [...prev, { name: "", contact: "", statement: "" }])}
            className="inline-flex items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            <Plus className="h-3 w-3" /> Add witness
          </button>
        </div>
        <ul className="space-y-3">
          {witnesses.map((w, i) => (
            <li key={i} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input
                      value={w.name}
                      onChange={(e) =>
                        setWitnesses((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x))
                        )
                      }
                      placeholder="Name"
                    />
                    <Input
                      value={w.contact}
                      onChange={(e) =>
                        setWitnesses((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, contact: e.target.value } : x))
                        )
                      }
                      placeholder="Contact (optional)"
                    />
                  </div>
                  <Textarea
                    value={w.statement}
                    onChange={(e) =>
                      setWitnesses((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, statement: e.target.value } : x))
                      )
                    }
                    rows={2}
                    placeholder="Brief statement (optional)"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setWitnesses((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remove witness"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {state?.ok === false && state.error !== "Validation failed" && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex items-center justify-between border-t pt-4">
        <a
          href={`/incidents/new/1?id=${incidentId}`}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Back
        </a>
        <button
          type="submit"
          disabled={isPending || matrix.likelihood === null || matrix.consequence === null}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Continue to Step 3"}
        </button>
      </div>
    </form>
    </TooltipProvider>
  );
}
