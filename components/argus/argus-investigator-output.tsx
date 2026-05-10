"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  Check,
  X,
  ListOrdered,
  ListChecks,
  Target,
  AlignLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { saveInvestigationText, saveWhy } from "@/app/(app)/investigations/[id]/actions";
import {
  acceptArgusSuggestion,
  rejectArgusSuggestion,
} from "@/app/(app)/investigations/[id]/argus-actions";
import type { InvestigationDraftPayload } from "@/lib/argus/tools";

const ACCENT = "var(--argus-accent, #00D4FF)";

export interface InvestigatorExisting {
  findings: string;
  rootCauseSummary: string;
  hasAnyWhys: boolean;
}

type SectionKey = "timeline" | "whys" | "root_cause_summary" | "findings";
type PushState = "idle" | "pushing" | "pushed" | "error";

interface DraftEditState {
  timelineMd: string;
  whys: { level: number; question: string; answer: string }[];
  rootCauseSummary: string;
  findings: string;
}

/**
 * Argus output panel — four review cards (Timeline, 5-Why, Root Cause,
 * Findings). Each card is editable in place; per-card Push commits via the
 * existing investigation Server Actions and flips the suggestion outcome
 * (accepted vs edited based on whether the user changed the draft text
 * before pushing).
 */
export function ArgusInvestigatorOutput({
  investigationId,
  draft,
  suggestionId,
  insufficientReason,
  existing,
  onDiscard,
}: {
  investigationId: string;
  draft: InvestigationDraftPayload;
  suggestionId: string;
  insufficientReason: string | null;
  existing: InvestigatorExisting;
  onDiscard: () => void;
}) {
  const router = useRouter();
  const [pushState, setPushState] = useState<Record<SectionKey, PushState>>({
    timeline: "idle",
    whys: "idle",
    root_cause_summary: "idle",
    findings: "idle",
  });
  const [pushedSections, setPushedSections] = useState<Set<SectionKey>>(new Set());
  const [errors, setErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [pendingPush, setPendingPush] = useState<{
    section: SectionKey;
    mode?: "replace" | "append";
  } | null>(null);

  // Local editable copy of the draft. Pre-seeded from the model's output;
  // each edit feeds into push-time diff detection so we know whether to
  // record the suggestion outcome as `accepted` (no edits) or `edited`.
  const [edit, setEdit] = useState<DraftEditState>(() => ({
    timelineMd: timelineToMarkdown(draft.timeline),
    whys: ensureFiveWhys(draft.whys),
    rootCauseSummary: draft.root_cause_summary ?? "",
    findings: draft.findings ?? "",
  }));

  const original = useState<DraftEditState>(() => ({
    timelineMd: timelineToMarkdown(draft.timeline),
    whys: ensureFiveWhys(draft.whys),
    rootCauseSummary: draft.root_cause_summary ?? "",
    findings: draft.findings ?? "",
  }))[0];

  if (insufficientReason) {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm dark:border-yellow-900/40 dark:bg-yellow-950/30">
        <p className="font-medium">Argus did not draft</p>
        <p className="mt-1 text-muted-foreground">{insufficientReason}</p>
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  async function pushTimeline(mode: "replace" | "append") {
    setPushState((p) => ({ ...p, timeline: "pushing" }));
    setErrors((e) => ({ ...e, timeline: undefined }));

    const block = `## Timeline\n${edit.timelineMd.trim()}`;
    const value =
      mode === "append" && existing.findings.trim().length > 0
        ? `${block}\n\n${existing.findings.trim()}`
        : block;

    const res = await saveInvestigationText({
      investigation_id: investigationId,
      field: "findings",
      value,
    });
    if (!res.ok) {
      setPushState((p) => ({ ...p, timeline: "error" }));
      setErrors((e) => ({ ...e, timeline: res.error }));
      return;
    }

    const wasEdited = edit.timelineMd.trim() !== original.timelineMd.trim();
    await acceptArgusSuggestion({
      suggestionId,
      investigationId,
      section: "timeline",
      wasEdited,
      diff: wasEdited
        ? { before: original.timelineMd, after: edit.timelineMd }
        : undefined,
    });
    setPushState((p) => ({ ...p, timeline: "pushed" }));
    setPushedSections((prev) => new Set(prev).add("timeline"));
    router.refresh();
  }

  async function pushWhys() {
    setPushState((p) => ({ ...p, whys: "pushing" }));
    setErrors((e) => ({ ...e, whys: undefined }));

    for (const row of edit.whys) {
      const res = await saveWhy({
        investigation_id: investigationId,
        level: row.level,
        question: row.question,
        answer: row.answer,
      });
      if (!res.ok) {
        setPushState((p) => ({ ...p, whys: "error" }));
        setErrors((e) => ({ ...e, whys: res.error }));
        return;
      }
    }

    const wasEdited =
      JSON.stringify(edit.whys) !== JSON.stringify(original.whys);
    await acceptArgusSuggestion({
      suggestionId,
      investigationId,
      section: "whys",
      wasEdited,
      diff: wasEdited ? { before: original.whys, after: edit.whys } : undefined,
    });
    setPushState((p) => ({ ...p, whys: "pushed" }));
    setPushedSections((prev) => new Set(prev).add("whys"));
    router.refresh();
  }

  async function pushTextField(
    section: "root_cause_summary" | "findings",
    mode: "replace" | "append",
  ) {
    setPushState((p) => ({ ...p, [section]: "pushing" }));
    setErrors((e) => ({ ...e, [section]: undefined }));

    const draftText =
      section === "root_cause_summary" ? edit.rootCauseSummary : edit.findings;
    const existingText =
      section === "root_cause_summary"
        ? existing.rootCauseSummary
        : existing.findings;
    const value =
      mode === "append" && existingText.trim().length > 0
        ? `${existingText.trim()}\n\n${draftText.trim()}`
        : draftText;

    const res = await saveInvestigationText({
      investigation_id: investigationId,
      field: section,
      value,
    });
    if (!res.ok) {
      setPushState((p) => ({ ...p, [section]: "error" }));
      setErrors((e) => ({ ...e, [section]: res.error }));
      return;
    }

    const originalText =
      section === "root_cause_summary"
        ? original.rootCauseSummary
        : original.findings;
    const wasEdited = draftText.trim() !== originalText.trim();
    await acceptArgusSuggestion({
      suggestionId,
      investigationId,
      section,
      wasEdited,
      diff: wasEdited ? { before: originalText, after: draftText } : undefined,
    });
    setPushState((p) => ({ ...p, [section]: "pushed" }));
    setPushedSections((prev) => new Set(prev).add(section));
    router.refresh();
  }

  async function discard() {
    await rejectArgusSuggestion({ suggestionId, investigationId });
    onDiscard();
    router.refresh();
  }

  function rejectSection(section: SectionKey) {
    setPushState((p) => ({ ...p, [section]: "pushed" }));
    setPushedSections((prev) => new Set(prev).add(section));
  }

  return (
    <>
      <div
        className="rounded-lg border bg-card"
        style={{
          borderColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 35%, transparent)",
        }}
      >
        <header
          className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
          style={{
            borderColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 35%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 6%, transparent)",
          }}
        >
          <div>
            <p
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide"
              style={{ color: ACCENT }}
            >
              <Sparkles className="h-3 w-3" /> Argus draft
            </p>
            <h2 className="text-base font-semibold">
              Review and edit before pushing
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Each section pushes independently. Nothing reaches the investigation until you click Push.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={discard}>
            <X className="mr-1 h-3.5 w-3.5" /> Discard entire draft
          </Button>
        </header>

        <div className="space-y-4 px-4 py-4">
          <SectionCard
            icon={<ListOrdered className="h-4 w-4" />}
            title="Timeline"
            description="Pushed into Findings under a `## Timeline` heading."
            pushed={pushedSections.has("timeline")}
            error={errors.timeline}
            actions={
              <SectionActions
                disabled={pushState.timeline === "pushing"}
                pushed={pushedSections.has("timeline")}
                onPush={() =>
                  existing.findings.trim().length > 0
                    ? setPendingPush({ section: "timeline" })
                    : void pushTimeline("replace")
                }
                onReject={() => rejectSection("timeline")}
                pushing={pushState.timeline === "pushing"}
              />
            }
          >
            <Textarea
              value={edit.timelineMd}
              onChange={(e) => setEdit((s) => ({ ...s, timelineMd: e.target.value }))}
              rows={6}
              className="font-mono text-[13px]"
              placeholder="- 2026-05-08T14:22Z — Worker JS slipped on oil patch in Bay 3."
            />
          </SectionCard>

          <SectionCard
            icon={<ListChecks className="h-4 w-4" />}
            title="5-Why chain"
            description="All 5 levels push at once. Replaces existing Why answers."
            pushed={pushedSections.has("whys")}
            error={errors.whys}
            actions={
              <SectionActions
                disabled={pushState.whys === "pushing"}
                pushed={pushedSections.has("whys")}
                onPush={() =>
                  existing.hasAnyWhys
                    ? setPendingPush({ section: "whys" })
                    : void pushWhys()
                }
                onReject={() => rejectSection("whys")}
                pushing={pushState.whys === "pushing"}
              />
            }
          >
            <ul className="space-y-3">
              {edit.whys.map((row, idx) => (
                <li
                  key={row.level}
                  className={
                    row.level === 5
                      ? "rounded-md border border-primary/30 bg-primary/5 p-3"
                      : "rounded-md border p-3"
                  }
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                        row.level === 5
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {row.level}
                    </span>
                    <span className="text-xs font-medium">
                      Why #{row.level}
                      {row.level === 5 && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                          <Target className="h-2.5 w-2.5" /> Root cause
                        </span>
                      )}
                    </span>
                  </div>
                  <Label htmlFor={`ai-why-q-${row.level}`} className="text-[10px] text-muted-foreground">
                    Question
                  </Label>
                  <Input
                    id={`ai-why-q-${row.level}`}
                    value={row.question}
                    maxLength={2000}
                    onChange={(e) => {
                      const next = [...edit.whys];
                      next[idx] = { ...row, question: e.target.value };
                      setEdit((s) => ({ ...s, whys: next }));
                    }}
                    className="mb-2"
                  />
                  <Label htmlFor={`ai-why-a-${row.level}`} className="text-[10px] text-muted-foreground">
                    Answer
                  </Label>
                  <Textarea
                    id={`ai-why-a-${row.level}`}
                    value={row.answer}
                    maxLength={5000}
                    rows={2}
                    onChange={(e) => {
                      const next = [...edit.whys];
                      next[idx] = { ...row, answer: e.target.value };
                      setEdit((s) => ({ ...s, whys: next }));
                    }}
                  />
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            icon={<Target className="h-4 w-4" />}
            title="Root cause summary"
            description="Pushed to investigations.root_cause_summary."
            pushed={pushedSections.has("root_cause_summary")}
            error={errors.root_cause_summary}
            actions={
              <SectionActions
                disabled={pushState.root_cause_summary === "pushing"}
                pushed={pushedSections.has("root_cause_summary")}
                onPush={() =>
                  existing.rootCauseSummary.trim().length > 0
                    ? setPendingPush({ section: "root_cause_summary" })
                    : void pushTextField("root_cause_summary", "replace")
                }
                onReject={() => rejectSection("root_cause_summary")}
                pushing={pushState.root_cause_summary === "pushing"}
              />
            }
          >
            <Textarea
              value={edit.rootCauseSummary}
              onChange={(e) =>
                setEdit((s) => ({ ...s, rootCauseSummary: e.target.value }))
              }
              rows={4}
              maxLength={20000}
              className="text-sm"
            />
          </SectionCard>

          <SectionCard
            icon={<AlignLeft className="h-4 w-4" />}
            title="Findings narrative"
            description="Pushed to investigations.findings."
            pushed={pushedSections.has("findings")}
            error={errors.findings}
            actions={
              <SectionActions
                disabled={pushState.findings === "pushing"}
                pushed={pushedSections.has("findings")}
                onPush={() =>
                  existing.findings.trim().length > 0
                    ? setPendingPush({ section: "findings" })
                    : void pushTextField("findings", "replace")
                }
                onReject={() => rejectSection("findings")}
                pushing={pushState.findings === "pushing"}
              />
            }
          >
            <Textarea
              value={edit.findings}
              onChange={(e) => setEdit((s) => ({ ...s, findings: e.target.value }))}
              rows={10}
              maxLength={20000}
              className="text-sm"
            />
          </SectionCard>
        </div>
      </div>

      <AlertDialog
        open={pendingPush !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPush(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingPush?.section === "whys"
                ? "Replace existing 5-Why answers?"
                : "Replace existing content?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPush?.section === "whys"
                ? "This investigation already has Why answers. Pushing will overwrite all 5 levels with the Argus draft. There's no append option for the 5-Why chain."
                : pendingPush?.section === "timeline"
                  ? "Findings already has content. Choose how Argus's timeline should land."
                  : "This field already has content. Choose how Argus's draft should land."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingPush(null)}>
              Cancel
            </AlertDialogCancel>
            {pendingPush?.section !== "whys" && (
              <AlertDialogAction
                onClick={() => {
                  if (!pendingPush) return;
                  const sec = pendingPush.section;
                  setPendingPush(null);
                  if (sec === "timeline") void pushTimeline("append");
                  else if (sec === "root_cause_summary" || sec === "findings")
                    void pushTextField(sec, "append");
                }}
              >
                Append
              </AlertDialogAction>
            )}
            <AlertDialogAction
              onClick={() => {
                if (!pendingPush) return;
                const sec = pendingPush.section;
                setPendingPush(null);
                if (sec === "timeline") void pushTimeline("replace");
                else if (sec === "whys") void pushWhys();
                else void pushTextField(sec, "replace");
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SectionCard({
  icon,
  title,
  description,
  pushed,
  error,
  children,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  pushed: boolean;
  error: string | undefined;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-md border bg-background ${
        pushed ? "border-green-300 bg-green-50/40 dark:border-green-900/40 dark:bg-green-950/20" : ""
      }`}
    >
      <header className="flex items-start justify-between gap-3 border-b px-3 py-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            {icon} {title}
            {pushed && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-green-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700 dark:text-green-400">
                <Check className="h-2.5 w-2.5" /> Pushed
              </span>
            )}
          </h3>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        {actions}
      </header>
      <div className="px-3 py-3">{children}</div>
      {error && (
        <p className="border-t border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function SectionActions({
  pushed,
  pushing,
  disabled,
  onPush,
  onReject,
}: {
  pushed: boolean;
  pushing: boolean;
  disabled: boolean;
  onPush: () => void;
  onReject: () => void;
}) {
  if (pushed) return null;
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onReject}
        disabled={disabled}
      >
        Reject
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onPush}
        disabled={disabled}
        style={{ backgroundColor: ACCENT, color: "#003" }}
      >
        {pushing ? (
          <>
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            Pushing…
          </>
        ) : (
          <>
            Push to investigation
          </>
        )}
      </Button>
    </div>
  );
}

function timelineToMarkdown(items: InvestigationDraftPayload["timeline"]): string {
  if (!Array.isArray(items)) return "";
  return items
    .map((it) => {
      const stamp = it.at ? it.at : it.relative_order ? `Step ${it.relative_order}` : "";
      return stamp ? `- ${stamp} — ${it.event}` : `- ${it.event}`;
    })
    .join("\n");
}

function ensureFiveWhys(
  whys: InvestigationDraftPayload["whys"],
): { level: number; question: string; answer: string }[] {
  const seeded: { level: number; question: string; answer: string }[] = [];
  for (let level = 1; level <= 5; level++) {
    const found = (whys ?? []).find((w) => w.level === level);
    seeded.push({
      level,
      question: found?.question ?? "",
      answer: found?.answer ?? "",
    });
  }
  return seeded;
}
