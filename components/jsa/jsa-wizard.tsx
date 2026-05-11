"use client";

/**
 * Wizard for JSA Steps 2–4 (the post-Step-1 editing surface). Renders only
 * when the JSA is in `draft` status. Steps 2 (task breakdown) and 3
 * (hazards + controls) share local state; Step 4 is the approval gate.
 *
 * URL slug pattern: /jsa/[id]/edit?step=steps|hazards|approve. The first
 * Step-1 form lives at /jsa/new and redirects here on success.
 */

import { useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RiskMatrixHazard } from "@/components/risk-matrix/risk-matrix-hazard";
import {
  ArgusStepHazardsWand,
  type StepHazardSuggestion,
} from "./argus-step-hazards-wand";
import {
  ArgusStepControlsWand,
  type StepControlSuggestion,
} from "./argus-step-controls-wand";
import {
  updateJsa,
  submitForReview,
  approveJsa,
} from "@/lib/actions/jsa";
import {
  HAZARD_CATEGORY_VALUES,
  CONTROL_LEVEL_VALUES,
  type Likelihood,
  type Consequence,
  type HazardCategory,
  type ControlLevel,
} from "@/lib/risk/types";
import { CONTROL_LEVEL_LABELS } from "@/lib/risk/matrix";

const CATEGORY_LABEL: Record<HazardCategory, string> = {
  physical: "Physical",
  chemical: "Chemical",
  biological: "Biological",
  psychosocial: "Psychosocial",
  mechanical: "Mechanical",
  electrical: "Electrical",
  ergonomic: "Ergonomic",
  environmental: "Environmental",
};

type StepHazardControl = {
  control_level: ControlLevel;
  control_description: string;
};

type StepHazard = {
  // Local IDs are random uuids so React keys are stable across re-renders.
  // Server-side IDs are not preserved (full-replace updateJsa).
  uid: string;
  hazard_description: string;
  hazard_category: HazardCategory;
  likelihood: Likelihood | null;
  consequence: Consequence | null;
  controls: StepHazardControl[];
};

type Step = {
  uid: string;
  step_description: string;
  hazards: StepHazard[];
};

function newUid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export type JsaWizardData = {
  jsaId: string;
  siteId: string;
  title: string;
  job_description: string | null;
  area: string | null;
  performed_by_roles: string[];
  performed_by_workgroups: string[];
  frequency: string | null;
  estimated_duration_minutes: number | null;
  ppe_required: string[];
  permits_required: string[];
  status: "draft" | "under_review" | "approved" | "expired" | "archived";
  created_by: string;
  steps: Array<{
    step_description: string;
    hazards: Array<{
      hazard_description: string;
      hazard_category: HazardCategory;
      likelihood: Likelihood;
      consequence: Consequence;
      controls: Array<{ control_level: ControlLevel; control_description: string }>;
    }>;
  }>;
};

export type JsaWizardViewer = {
  userId: string;
  canDraft: boolean;
  canApprove: boolean;
};

const SLUG_TO_STEP = { steps: 2, hazards: 3, approve: 4 } as const;
type WizardStep = keyof typeof SLUG_TO_STEP;

export function JsaWizard({
  data,
  viewer,
}: {
  data: JsaWizardData;
  viewer: JsaWizardViewer;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStep = searchParams.get("step");
  const currentStep: WizardStep =
    rawStep === "hazards" || rawStep === "approve" ? rawStep : "steps";

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>(() =>
    data.steps.map((s) => ({
      uid: newUid("st"),
      step_description: s.step_description,
      hazards: s.hazards.map((h) => ({
        uid: newUid("hz"),
        hazard_description: h.hazard_description,
        hazard_category: h.hazard_category,
        likelihood: h.likelihood,
        consequence: h.consequence,
        controls: h.controls.map((c) => ({
          control_level: c.control_level,
          control_description: c.control_description,
        })),
      })),
    })),
  );

  function gotoStep(s: WizardStep) {
    router.push(`/jsa/${data.jsaId}/edit?step=${s}`);
  }

  function savePayload() {
    return {
      title: data.title,
      job_description: data.job_description,
      area: data.area,
      performed_by_roles: data.performed_by_roles,
      performed_by_workgroups: data.performed_by_workgroups,
      frequency: data.frequency as
        | "daily"
        | "weekly"
        | "monthly"
        | "as_needed"
        | "one_off"
        | "continuous"
        | null,
      estimated_duration_minutes: data.estimated_duration_minutes,
      ppe_required: data.ppe_required,
      permits_required: data.permits_required,
      steps: steps.map((s) => ({
        step_description: s.step_description,
        hazards: s.hazards
          .filter((h) => h.likelihood !== null && h.consequence !== null)
          .map((h) => ({
            hazard_description: h.hazard_description,
            hazard_category: h.hazard_category,
            likelihood: h.likelihood!,
            consequence: h.consequence!,
            controls: h.controls,
          })),
      })),
    };
  }

  function persist(opts: { onSuccess?: () => void; toastMsg?: string }) {
    setError(null);
    startTransition(async () => {
      const result = await updateJsa(data.jsaId, savePayload());
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      if (opts.toastMsg) toast.success(opts.toastMsg);
      router.refresh();
      opts.onSuccess?.();
    });
  }

  function onSubmitForReview() {
    setError(null);
    startTransition(async () => {
      const saveResult = await updateJsa(data.jsaId, savePayload());
      if (!saveResult.ok) {
        setError(saveResult.error);
        toast.error(saveResult.error);
        return;
      }
      const submitResult = await submitForReview(data.jsaId);
      if (!submitResult.ok) {
        setError(submitResult.error);
        toast.error(submitResult.error);
        return;
      }
      toast.success("Submitted for approval");
      router.push(`/jsa/${data.jsaId}`);
    });
  }

  return (
    <div className="space-y-6">
      <WizardTabs current={currentStep} onChange={gotoStep} />

      {currentStep === "steps" && (
        <StepsView
          steps={steps}
          setSteps={setSteps}
        />
      )}

      {currentStep === "hazards" && (
        <HazardsView steps={steps} setSteps={setSteps} jsa={data} />
      )}

      {currentStep === "approve" && (
        <ApproveView
          data={data}
          viewer={viewer}
          steps={steps}
          onSubmitForReview={onSubmitForReview}
          pending={pending}
        />
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/jsa/${data.jsaId}`)}
          disabled={pending}
        >
          Back to detail
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => persist({ toastMsg: "Draft saved" })}
            disabled={pending}
          >
            {pending ? "Saving…" : "Save draft"}
          </Button>
          {currentStep === "steps" && (
            <Button type="button" onClick={() => persist({ onSuccess: () => gotoStep("hazards") })} disabled={pending}>
              Next — hazards <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {currentStep === "hazards" && (
            <>
              <Button type="button" variant="ghost" onClick={() => gotoStep("steps")} disabled={pending}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Steps
              </Button>
              <Button type="button" onClick={() => persist({ onSuccess: () => gotoStep("approve") })} disabled={pending}>
                Next — approve <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </>
          )}
          {currentStep === "approve" && (
            <Button type="button" variant="ghost" onClick={() => gotoStep("hazards")} disabled={pending}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Hazards
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function WizardTabs({
  current,
  onChange,
}: {
  current: WizardStep;
  onChange: (s: WizardStep) => void;
}) {
  const steps: Array<{ slug: WizardStep; label: string }> = [
    { slug: "steps", label: "2. Task steps" },
    { slug: "hazards", label: "3. Hazards & controls" },
    { slug: "approve", label: "4. Review & approve" },
  ];
  return (
    <div className="flex flex-wrap gap-2 border-b pb-2">
      {steps.map((s) => (
        <button
          key={s.slug}
          type="button"
          onClick={() => onChange(s.slug)}
          className={
            "rounded-md px-3 py-1.5 text-sm font-medium transition " +
            (current === s.slug
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted")
          }
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Step 2: task breakdown ----------

function StepsView({
  steps,
  setSteps,
}: {
  steps: Step[];
  setSteps: (next: Step[] | ((prev: Step[]) => Step[])) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSteps((prev) => {
      const oldIndex = prev.findIndex((s) => s.uid === active.id);
      const newIndex = prev.findIndex((s) => s.uid === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { uid: newUid("st"), step_description: "", hazards: [] },
    ]);
  }

  function updateStep(uid: string, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
  }

  function removeStep(uid: string) {
    setSteps((prev) => prev.filter((s) => s.uid !== uid));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Break the job into steps</h2>
        <p className="text-sm text-muted-foreground">
          Each step is a discrete part of the job. Workers reading the JSA should see how they'd actually perform the work, in order.
        </p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map((s) => s.uid)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {steps.map((s, idx) => (
              <SortableStepRow
                key={s.uid}
                step={s}
                index={idx}
                onUpdate={(patch) => updateStep(s.uid, patch)}
                onRemove={() => removeStep(s.uid)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" onClick={addStep}>
        <Plus className="mr-1 h-4 w-4" /> Add step
      </Button>
    </div>
  );
}

function SortableStepRow({
  step,
  index,
  onUpdate,
  onRemove,
}: {
  step: Step;
  index: number;
  onUpdate: (patch: Partial<Step>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.uid });
  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="flex items-start gap-2 rounded-lg border bg-card p-3">
      <button
        type="button"
        className="mt-2 cursor-grab text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder step"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="mt-2 w-6 text-right text-sm font-medium text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <Textarea
        rows={2}
        value={step.step_description}
        onChange={(e) => onUpdate({ step_description: e.target.value })}
        placeholder="Describe this step…"
        className="min-h-0 flex-1"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        aria-label="Remove step"
        className="mt-1 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

// ---------- Step 3: per-step hazards + controls ----------

function HazardsView({
  steps,
  setSteps,
  jsa,
}: {
  steps: Step[];
  setSteps: (next: Step[] | ((prev: Step[]) => Step[])) => void;
  jsa: JsaWizardData;
}) {
  if (steps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Add steps first on the previous tab.
      </div>
    );
  }

  function addHazard(stepUid: string) {
    setSteps((prev) =>
      prev.map((s) =>
        s.uid === stepUid
          ? {
              ...s,
              hazards: [
                ...s.hazards,
                {
                  uid: newUid("hz"),
                  hazard_description: "",
                  hazard_category: "physical",
                  likelihood: null,
                  consequence: null,
                  controls: [],
                },
              ],
            }
          : s,
      ),
    );
  }

  function updateHazard(stepUid: string, hzUid: string, patch: Partial<StepHazard>) {
    setSteps((prev) =>
      prev.map((s) =>
        s.uid === stepUid
          ? {
              ...s,
              hazards: s.hazards.map((h) => (h.uid === hzUid ? { ...h, ...patch } : h)),
            }
          : s,
      ),
    );
  }

  function removeHazard(stepUid: string, hzUid: string) {
    setSteps((prev) =>
      prev.map((s) =>
        s.uid === stepUid ? { ...s, hazards: s.hazards.filter((h) => h.uid !== hzUid) } : s,
      ),
    );
  }

  function addControl(stepUid: string, hzUid: string) {
    setSteps((prev) =>
      prev.map((s) =>
        s.uid === stepUid
          ? {
              ...s,
              hazards: s.hazards.map((h) =>
                h.uid === hzUid
                  ? {
                      ...h,
                      controls: [
                        ...h.controls,
                        { control_level: "engineering", control_description: "" },
                      ],
                    }
                  : h,
              ),
            }
          : s,
      ),
    );
  }

  function updateControl(
    stepUid: string,
    hzUid: string,
    idx: number,
    patch: Partial<StepHazardControl>,
  ) {
    setSteps((prev) =>
      prev.map((s) =>
        s.uid === stepUid
          ? {
              ...s,
              hazards: s.hazards.map((h) =>
                h.uid === hzUid
                  ? {
                      ...h,
                      controls: h.controls.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
                    }
                  : h,
              ),
            }
          : s,
      ),
    );
  }

  function appendHazards(stepUid: string, suggestions: StepHazardSuggestion[]) {
    setSteps((prev) =>
      prev.map((s) =>
        s.uid === stepUid
          ? {
              ...s,
              hazards: [
                ...s.hazards,
                ...suggestions.map((h) => ({
                  uid: newUid("hz"),
                  hazard_description: h.hazard_description,
                  hazard_category: h.hazard_category,
                  likelihood: h.likelihood as Likelihood | null,
                  consequence: h.consequence as Consequence | null,
                  controls: [] as StepHazardControl[],
                })),
              ],
            }
          : s,
      ),
    );
  }

  function appendControls(stepUid: string, hzUid: string, suggestions: StepControlSuggestion[]) {
    setSteps((prev) =>
      prev.map((s) =>
        s.uid === stepUid
          ? {
              ...s,
              hazards: s.hazards.map((h) =>
                h.uid === hzUid
                  ? { ...h, controls: [...h.controls, ...suggestions] }
                  : h,
              ),
            }
          : s,
      ),
    );
  }

  function removeControl(stepUid: string, hzUid: string, idx: number) {
    setSteps((prev) =>
      prev.map((s) =>
        s.uid === stepUid
          ? {
              ...s,
              hazards: s.hazards.map((h) =>
                h.uid === hzUid ? { ...h, controls: h.controls.filter((_, i) => i !== idx) } : h,
              ),
            }
          : s,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Add hazards and controls per step</h2>
        <p className="text-sm text-muted-foreground">
          For each step, list the hazards a worker could encounter and the controls that mitigate them. Higher-tier controls (elimination, substitution, engineering) are preferred over PPE.
        </p>
      </div>

      {steps.map((s, idx) => (
        <div key={s.uid} className="rounded-lg border bg-card p-4">
          <div className="mb-3">
            <span className="text-xs font-medium text-muted-foreground">Step {idx + 1}</span>
            <p className="text-sm font-medium">{s.step_description || "(no description)"}</p>
          </div>
          <ul className="space-y-3">
            {s.hazards.map((h) => (
              <li key={h.uid} className="rounded-md border bg-background p-3">
                <div className="flex items-start gap-2">
                  <Textarea
                    rows={2}
                    value={h.hazard_description}
                    onChange={(e) => updateHazard(s.uid, h.uid, { hazard_description: e.target.value })}
                    placeholder="What's the hazard?"
                    className="min-h-0 flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeHazard(s.uid, h.uid)}
                    aria-label="Remove hazard"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr]">
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select
                      value={h.hazard_category}
                      onValueChange={(v) => updateHazard(s.uid, h.uid, { hazard_category: v as HazardCategory })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HAZARD_CATEGORY_VALUES.map((c) => (
                          <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Risk score</Label>
                    <RiskMatrixHazard
                      value={{ likelihood: h.likelihood, consequence: h.consequence }}
                      onChange={({ likelihood, consequence }) =>
                        updateHazard(s.uid, h.uid, { likelihood, consequence })
                      }
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Controls</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addControl(s.uid, h.uid)}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add control
                    </Button>
                  </div>
                  {h.likelihood && h.consequence && h.hazard_description.trim().length > 8 && (
                    <div className="mb-2">
                      <ArgusStepControlsWand
                        siteId={jsa.siteId}
                        jsaId={jsa.jsaId}
                        jobTitle={jsa.title}
                        area={jsa.area}
                        stepDescription={s.step_description}
                        hazardDescription={h.hazard_description}
                        hazardCategory={h.hazard_category}
                        likelihood={h.likelihood}
                        consequence={h.consequence}
                        onAccept={(controls) => appendControls(s.uid, h.uid, controls)}
                      />
                    </div>
                  )}
                  <ul className="space-y-2">
                    {h.controls.map((c, ci) => (
                      <li key={ci} className="flex items-start gap-2">
                        <Select
                          value={c.control_level}
                          onValueChange={(v) => updateControl(s.uid, h.uid, ci, { control_level: v as ControlLevel })}
                        >
                          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CONTROL_LEVEL_VALUES.map((lvl) => (
                              <SelectItem key={lvl} value={lvl}>
                                {CONTROL_LEVEL_LABELS[lvl]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={c.control_description}
                          onChange={(e) => updateControl(s.uid, h.uid, ci, { control_description: e.target.value })}
                          placeholder="What's the control?"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeControl(s.uid, h.uid, ci)}
                          aria-label="Remove control"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addHazard(s.uid)}>
              <Plus className="mr-1 h-3 w-3" /> Add hazard
            </Button>
            <ArgusStepHazardsWand
              siteId={jsa.siteId}
              jsaId={jsa.jsaId}
              jobTitle={jsa.title}
              jobDescription={jsa.job_description}
              area={jsa.area}
              stepDescription={s.step_description}
              onAccept={(hazards) => appendHazards(s.uid, hazards)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Step 4: review + approve ----------

function ApproveView({
  data,
  viewer,
  steps,
  onSubmitForReview,
  pending,
}: {
  data: JsaWizardData;
  viewer: JsaWizardViewer;
  steps: Step[];
  onSubmitForReview: () => void;
  pending: boolean;
}) {
  const router = useRouter();
  const [pendingApprove, startApproveTransition] = useTransition();
  const [expiresAt, setExpiresAt] = useState<string>(() => defaultExpiry());
  const [approveError, setApproveError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let hazards = 0;
    let controls = 0;
    let scored = 0;
    for (const s of steps) {
      for (const h of s.hazards) {
        hazards += 1;
        controls += h.controls.length;
        if (h.likelihood !== null && h.consequence !== null) scored += 1;
      }
    }
    return { hazards, controls, scored, steps: steps.length };
  }, [steps]);

  const isCreator = viewer.userId === data.created_by;
  const canApproveNow =
    data.status === "under_review" && viewer.canApprove && !isCreator;
  const canSubmit = data.status === "draft" && viewer.canDraft && totals.scored > 0;

  function onApprove() {
    setApproveError(null);
    startApproveTransition(async () => {
      const result = await approveJsa(data.jsaId, { expires_at: expiresAt });
      if (!result.ok) {
        setApproveError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("JSA approved");
      router.push(`/jsa/${data.jsaId}`);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Review & approve</h2>
        <p className="text-sm text-muted-foreground">
          Confirm the analysis is complete. The approver must be different from the creator (three-layer enforcement).
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 text-sm sm:grid-cols-4">
        <Summary label="Steps" value={String(totals.steps)} />
        <Summary label="Hazards" value={String(totals.hazards)} />
        <Summary label="Scored" value={String(totals.scored)} />
        <Summary label="Controls" value={String(totals.controls)} />
      </dl>

      {data.status === "draft" && (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-medium">Currently a draft.</p>
          <p className="text-muted-foreground">
            Submit for approval to move it to an approver. Approval grants workers the ability to sign off and perform this job.
          </p>
        </div>
      )}

      {data.status === "draft" && (
        <div className="flex justify-end">
          <Button type="button" onClick={onSubmitForReview} disabled={pending || !canSubmit}>
            <ShieldCheck className="mr-1 h-4 w-4" />
            {pending ? "Submitting…" : "Submit for approval"}
          </Button>
        </div>
      )}

      {data.status === "under_review" && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium">Under review — awaiting approver.</p>
          <p className="text-muted-foreground">
            {isCreator
              ? "You created this JSA. An EHS Manager or Site Admin (other than you) must approve."
              : viewer.canApprove
                ? "You hold jsa:approve. Set an expiry and approve below."
                : "Only users with jsa:approve can finalize."}
          </p>
        </div>
      )}

      {canApproveNow && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div>
            <Label htmlFor="expires_at">Expires at</Label>
            <Input
              id="expires_at"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="max-w-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Default is 12 months. Override per your site's review policy.
            </p>
          </div>
          {approveError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {approveError}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="button" onClick={onApprove} disabled={pendingApprove}>
              {pendingApprove ? "Approving…" : "Approve JSA"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function defaultExpiry(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 12);
  return d.toISOString().slice(0, 10);
}
