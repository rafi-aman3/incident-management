"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  convertCandidate,
  dismissCandidate,
  mergeCandidate,
} from "@/lib/actions/hazard-candidates";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RiskMatrixHazard } from "@/components/risk-matrix/risk-matrix-hazard";
import { computeRisk, computeResidual } from "@/lib/risk/matrix";
import {
  HAZARD_CATEGORY_VALUES,
  CONTROL_LEVEL_VALUES,
  type Likelihood,
  type Consequence,
  type ControlLevel,
} from "@/lib/risk/types";
import { RiskBadge, ControlLevelBadge } from "./risk-badges";
import { Plus, Trash2 } from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = {
  physical: "Physical",
  chemical: "Chemical",
  biological: "Biological",
  psychosocial: "Psychosocial",
  mechanical: "Mechanical",
  electrical: "Electrical",
  ergonomic: "Ergonomic",
  environmental: "Environmental",
};

const CONTROL_LEVEL_LABEL: Record<ControlLevel, string> = {
  elimination: "Elimination",
  substitution: "Substitution",
  engineering: "Engineering",
  administrative: "Administrative",
  ppe: "PPE",
};

type SuggestedControl = {
  level: ControlLevel;
  description: string;
};

type CandidateForReview = {
  id: string;
  source_type: string;
  proposed_title: string;
  proposed_category: string;
  proposed_description: string | null;
  site_id: string | null;
  area: string | null;
  proposed_metadata: Record<string, unknown> | null;
};

export type ReviewableSite = { id: string; name: string };

export function CandidateReviewForm({
  candidate,
  sites,
  defaultSiteId,
  existingHazards,
}: {
  candidate: CandidateForReview;
  sites: ReviewableSite[];
  defaultSiteId: string | null;
  existingHazards: Array<{ id: string; ref_code: string | null; title: string }>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"convert" | "dismiss" | "merge">("convert");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Convert form
  const [title, setTitle] = useState(candidate.proposed_title);
  const [description, setDescription] = useState(candidate.proposed_description ?? "");
  const [siteId, setSiteId] = useState(candidate.site_id ?? defaultSiteId ?? sites[0]?.id ?? "");
  const [area, setArea] = useState(candidate.area ?? "");
  const [category, setCategory] = useState(candidate.proposed_category);
  const [likelihood, setLikelihood] = useState<Likelihood | null>(null);
  const [consequence, setConsequence] = useState<Consequence | null>(null);
  const [rationale, setRationale] = useState("");

  // Pre-fill controls from candidate.proposed_metadata.suggested_controls if present
  const suggested = parseSuggested(candidate.proposed_metadata?.suggested_controls);
  const [controls, setControls] = useState<SuggestedControl[]>(suggested);

  // Dismiss form
  const [dismissReason, setDismissReason] = useState("");

  // Merge form
  const [mergeIntoId, setMergeIntoId] = useState<string>(existingHazards[0]?.id ?? "");
  const [mergeNote, setMergeNote] = useState("");

  const inherent = likelihood && consequence ? computeRisk(likelihood, consequence) : null;
  const residual =
    inherent && controls.length > 0
      ? computeResidual(inherent, controls.map((c) => c.level))
      : inherent;

  function onConvert() {
    setError(null);
    if (!siteId) {
      setError("Pick a site.");
      return;
    }
    if (!likelihood || !consequence) {
      setError("Pick a likelihood × consequence cell.");
      return;
    }
    startTransition(async () => {
      const result = await convertCandidate(candidate.id, {
        hazard: {
          site_id: siteId,
          area: area || null,
          title: title.trim(),
          description: description.trim() || null,
          hazard_category: category as (typeof HAZARD_CATEGORY_VALUES)[number],
          affects_workers: [],
          affects_others: [],
          identification_method: null,
          source_incident_id: null,
          source_sds_id: null,
          source_sds_section: null,
        },
        initial_assessment: {
          likelihood,
          consequence,
          trigger_type: "initial",
          rationale: rationale || null,
          consulted_worker_ids: [],
          control_levels: controls.map((c) => c.level),
        },
        initial_controls: controls.map((c) => ({
          control_level: c.level,
          control_description: c.description,
          effectiveness: "not_yet_verified" as const,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`Converted to ${result.data?.ref_code ?? "new hazard"}`);
      router.push(`/hazards/${result.data?.hazard_id}`);
    });
  }

  function onDismiss() {
    setError(null);
    if (dismissReason.trim().length < 3) {
      setError("Give a brief reason.");
      return;
    }
    startTransition(async () => {
      const result = await dismissCandidate(candidate.id, { reason: dismissReason.trim() });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Candidate dismissed");
      router.push("/hazards/candidates");
    });
  }

  function onMerge() {
    setError(null);
    if (!mergeIntoId) {
      setError("Pick a hazard to merge into.");
      return;
    }
    startTransition(async () => {
      const result = await mergeCandidate(candidate.id, {
        into_hazard_id: mergeIntoId,
        note: mergeNote || null,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Candidate merged");
      router.push(`/hazards/${mergeIntoId}`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1 border-b">
        {(["convert", "dismiss", "merge"] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={active}
              className={
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
                (active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {m === "convert" ? "Convert" : m === "dismiss" ? "Dismiss" : "Merge"}
            </button>
          );
        })}
      </div>

      {mode === "convert" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
            </div>
            <div>
              <Label htmlFor="cat">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="cat"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HAZARD_CATEGORY_VALUES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="site">Site</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger id="site"><SelectValue placeholder="Pick a site" /></SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="area">Area</Label>
              <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Initial risk assessment</Label>
              {inherent && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Inherent</span><RiskBadge score={inherent} />
                  <span className="text-muted-foreground">→ Residual</span><RiskBadge score={residual} />
                </div>
              )}
            </div>
            <RiskMatrixHazard
              value={{ likelihood, consequence }}
              onChange={(v) => { setLikelihood(v.likelihood); setConsequence(v.consequence); }}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Initial controls (optional)</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setControls((s) => [...s, { level: "engineering", description: "" }])}
              >
                <Plus className="mr-1 h-3 w-3" /> Add control
              </Button>
            </div>
            {controls.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                Add at least one control to reduce inherent risk to residual.
              </p>
            ) : (
              <ul className="space-y-2">
                {controls.map((c, i) => (
                  <li key={i} className="rounded-md border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <Select
                        value={c.level}
                        onValueChange={(v) => setControls((s) => s.map((x, j) => j === i ? { ...x, level: v as ControlLevel } : x))}
                      >
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONTROL_LEVEL_VALUES.map((l) => (<SelectItem key={l} value={l}>{CONTROL_LEVEL_LABEL[l]}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <ControlLevelBadge level={c.level} />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setControls((s) => s.filter((_, j) => j !== i))}
                        className="ml-auto"
                        aria-label="Remove control"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      className="mt-2"
                      value={c.description}
                      onChange={(e) => setControls((s) => s.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                      placeholder="Describe the control"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <Label htmlFor="rationale">Assessment rationale (optional)</Label>
            <Textarea id="rationale" rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button onClick={onConvert} disabled={pending || !title || !siteId || !likelihood || !consequence}>
              {pending ? "Converting…" : "Convert to hazard"}
            </Button>
          </div>
        </div>
      )}

      {mode === "dismiss" && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="dismiss-reason">Reason</Label>
            <Textarea
              id="dismiss-reason"
              rows={3}
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="Why doesn't this belong on the register? (e.g. already controlled by existing hazard, false positive, not a hazard)"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button variant="destructive" onClick={onDismiss} disabled={pending}>
              {pending ? "Dismissing…" : "Dismiss candidate"}
            </Button>
          </div>
        </div>
      )}

      {mode === "merge" && (
        <div className="space-y-4">
          {existingHazards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No existing hazards to merge into. Use Convert instead.
            </p>
          ) : (
            <>
              <div>
                <Label htmlFor="merge-into">Merge into hazard</Label>
                <Select value={mergeIntoId} onValueChange={setMergeIntoId}>
                  <SelectTrigger id="merge-into"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {existingHazards.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.ref_code ?? h.id.slice(0, 8)} · {h.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="merge-note">Note (optional)</Label>
                <Textarea id="merge-note" rows={2} value={mergeNote} onChange={(e) => setMergeNote(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end">
                <Button onClick={onMerge} disabled={pending || !mergeIntoId}>
                  {pending ? "Merging…" : "Merge candidate"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function parseSuggested(raw: unknown): SuggestedControl[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is { level: string; description: string } =>
      typeof r === "object" && r !== null && "level" in r && "description" in r
    )
    .filter((r) => CONTROL_LEVEL_VALUES.includes(r.level as ControlLevel))
    .map((r) => ({
      level: r.level as ControlLevel,
      description: String(r.description),
    }));
}
