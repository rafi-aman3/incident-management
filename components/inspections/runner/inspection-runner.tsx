"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SignatureCanvas } from "@/components/inspections/runner/signature-canvas";
import { MediaUploader } from "@/components/inspections/runner/media-uploader";
import {
  NetworkIndicator,
  type SaveStatus,
} from "@/components/inspections/runner/network-indicator";
import { InfoTooltip } from "@/components/info-tooltip";
import {
  saveInspectionAnswer,
  completeInspection,
} from "@/app/(app)/inspections/actions";
import { createClient } from "@/lib/supabase/client";
import {
  buildQuestionAnswer,
  buildTextAnswer,
  buildDateTimeAnswer,
  buildSignatureAnswer,
  appendUpload,
  computeProgress,
  findRequiredUnanswered,
  findFailedAnswers,
  hasAnswer,
  type AnswerMap,
} from "@/lib/templates/answers";
import { buildTree, resolveAnswerSet, type ItemTreeNode } from "@/lib/templates/items";
import {
  isMvpType,
  isNonAnswerable,
  type TemplateNodeItem,
  type TemplateData,
  type InspectionAnswer,
} from "@/lib/templates/types";

type Props = {
  inspectionId: string;
  refCode: string;
  title: string;
  inspectorName: string;
  templateName: string;
  header: TemplateNodeItem[];
  items: TemplateNodeItem[];
  templateData: TemplateData;
  initialHeaderResponses: AnswerMap;
  initialAnswers: AnswerMap;
};

type PendingSave = {
  timer: ReturnType<typeof setTimeout>;
  scope: "header" | "body";
  itemId: string;
  answer: InspectionAnswer;
};

const SAVE_DEBOUNCE_MS = 1000;

export function InspectionRunner(props: Props) {
  const router = useRouter();
  const [headerResponses, setHeaderResponses] = useState<AnswerMap>(
    props.initialHeaderResponses
  );
  const [answers, setAnswers] = useState<AnswerMap>(props.initialAnswers);
  const [submitting, setSubmitting] = useTransition();
  const [missingDialogOpen, setMissingDialogOpen] = useState(false);
  const [flaggedDialogOpen, setFlaggedDialogOpen] = useState(false);
  const [missingItems, setMissingItems] = useState<TemplateNodeItem[]>([]);
  const [flaggedComments, setFlaggedComments] = useState<Record<string, string>>(
    {}
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Per-item debounced save: while the user is rapidly editing one item
  // (toggling a question, retyping a textarea after blur, etc.) we coalesce
  // network calls to one per SAVE_DEBOUNCE_MS. Latest payload wins.
  const pendingSaves = useRef(new Map<string, PendingSave>());
  const inFlightSaves = useRef(new Set<Promise<unknown>>());

  const refreshIdleStatus = useCallback(() => {
    if (
      inFlightSaves.current.size === 0 &&
      pendingSaves.current.size === 0
    ) {
      setSaveStatus((prev) => (prev === "error" ? prev : "saved"));
    }
  }, []);

  const runSave = useCallback(
    async (
      scope: "header" | "body",
      itemId: string,
      answer: InspectionAnswer,
    ): Promise<void> => {
      setSaveStatus("saving");
      const promise = saveInspectionAnswer({
        inspection_id: props.inspectionId,
        item_id: itemId,
        scope,
        answer,
      });
      inFlightSaves.current.add(promise);
      try {
        const res = await promise;
        if (res.ok) {
          setLastSavedAt(new Date());
        } else {
          setSaveStatus("error");
          toast.error(`Save failed: ${res.error}`);
          return;
        }
      } catch (e) {
        setSaveStatus("error");
        toast.error(
          `Save failed: ${e instanceof Error ? e.message : "unknown error"}`,
        );
        return;
      } finally {
        inFlightSaves.current.delete(promise);
      }
      refreshIdleStatus();
    },
    [props.inspectionId, refreshIdleStatus],
  );

  const queueSave = useCallback(
    (scope: "header" | "body", itemId: string, answer: InspectionAnswer) => {
      const key = `${scope}:${itemId}`;
      const existing = pendingSaves.current.get(key);
      if (existing) clearTimeout(existing.timer);
      setSaveStatus("saving");
      const timer = setTimeout(() => {
        pendingSaves.current.delete(key);
        void runSave(scope, itemId, answer);
      }, SAVE_DEBOUNCE_MS);
      pendingSaves.current.set(key, { timer, scope, itemId, answer });
    },
    [runSave],
  );

  const flushPending = useCallback(async (): Promise<void> => {
    const entries = Array.from(pendingSaves.current.values());
    pendingSaves.current.clear();
    for (const e of entries) clearTimeout(e.timer);
    await Promise.all(
      entries.map((e) => runSave(e.scope, e.itemId, e.answer)),
    );
    // Wait on any other in-flight saves (e.g. flushed during typing).
    if (inFlightSaves.current.size > 0) {
      await Promise.allSettled(Array.from(inFlightSaves.current));
    }
  }, [runSave]);

  // Cancel any pending debounce timers when the runner unmounts so we don't
  // fire saves into the void after navigation.
  useEffect(() => {
    const pending = pendingSaves.current;
    return () => {
      for (const e of pending.values()) clearTimeout(e.timer);
      pending.clear();
    };
  }, []);

  // One-time auto-populate: if a header text item is empty and isn't yet
  // answered, fill it with the inspector name. Same for the first
  // datetime item with the current ISO. (The reference does this with
  // a `auto_populate` flag on the item; for v1 we go by name-match.)
  const autoApplied = useRef(false);
  useEffect(() => {
    if (autoApplied.current) return;
    autoApplied.current = true;
    const updates: AnswerMap = {};
    for (const it of props.header) {
      if (headerResponses[it.item_id]) continue;
      const lower = (it.label ?? "").toLowerCase();
      if (it.type === "text" || it.type === "textsingle") {
        if (
          lower.includes("inspector") ||
          lower.includes("conducted by") ||
          lower.includes("reviewed by") ||
          lower.includes("prepared by")
        ) {
          updates[it.item_id] = buildTextAnswer(props.inspectorName);
        }
      } else if (it.type === "datetime") {
        if (lower.includes("conducted") || lower.includes("date")) {
          updates[it.item_id] = buildDateTimeAnswer(new Date().toISOString());
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      setHeaderResponses((prev) => ({ ...prev, ...updates }));
      for (const [itemId, answer] of Object.entries(updates)) {
        void runSave("header", itemId, answer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headerTree = useMemo(() => buildTree(props.header), [props.header]);
  const bodyTree = useMemo(() => buildTree(props.items), [props.items]);
  const progress = useMemo(
    () => computeProgress(props.items, answers),
    [props.items, answers]
  );

  function commit(scope: "header" | "body", itemId: string, answer: InspectionAnswer) {
    if (scope === "header") {
      setHeaderResponses((p) => ({ ...p, [itemId]: answer }));
    } else {
      setAnswers((p) => ({ ...p, [itemId]: answer }));
    }
    queueSave(scope, itemId, answer);
  }

  function handleSubmit() {
    const missing = findRequiredUnanswered(props.items, answers);
    if (missing.length > 0) {
      setMissingItems(missing);
      setMissingDialogOpen(true);
      return;
    }
    proceedToFlaggedReview();
  }

  function proceedToFlaggedReview() {
    setMissingDialogOpen(false);
    const failed = findFailedAnswers(props.items, answers);
    if (failed.length > 0) {
      // Pre-populate the comment textareas with whatever notes already exist
      const initial: Record<string, string> = {};
      for (const f of failed) {
        initial[f.item.item_id] = f.answer.notes ?? "";
      }
      setFlaggedComments(initial);
      setFlaggedDialogOpen(true);
      return;
    }
    submitNow();
  }

  function submitNow() {
    setFlaggedDialogOpen(false);
    setSubmitting(async () => {
      // Flush any debounced answer saves before completing — otherwise the
      // server-side complete RPC could read a stale JSONB blob.
      await flushPending();
      // Persist any flagged-item notes the user entered (immediate, not
      // debounced — we're about to call complete).
      const failed = findFailedAnswers(props.items, answers);
      for (const f of failed) {
        const c = flaggedComments[f.item.item_id];
        if (c !== undefined && c !== f.answer.notes) {
          const next = { ...f.answer, notes: c };
          await runSave("body", f.item.item_id, next);
        }
      }
      const res = await completeInspection(props.inspectionId);
      if (res.ok) {
        toast.success("Inspection completed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="-mx-6 -my-6 flex min-h-[calc(100vh-3.5rem)] flex-col bg-muted/30">
      {/* Topbar */}
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/inspections"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground sm:h-8 sm:w-8"
              aria-label="Back to inspections"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{props.title}</p>
              <p className="text-xs text-muted-foreground">
                {props.refCode} · {props.templateName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60 sm:min-h-0 sm:px-3 sm:py-1.5"
          >
            <Send className="h-4 w-4 sm:h-3 sm:w-3" /> Submit
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.round(progress.pct * 100)}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {progress.answered}/{progress.total}
          </span>
          <NetworkIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4">
        {headerTree.length > 0 && (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Title page
            </h2>
            <div className="mt-3 space-y-4">
              {headerTree.map((node) => (
                <RunnerNode
                  key={node.item.item_id}
                  node={node}
                  scope="header"
                  answers={headerResponses}
                  templateData={props.templateData}
                  inspectionId={props.inspectionId}
                  onCommit={commit}
                />
              ))}
            </div>
          </section>
        )}

        {bodyTree.length === 0 ? (
          <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
            This template has no checklist items.
          </div>
        ) : (
          bodyTree.map((node) => (
            <RunnerNode
              key={node.item.item_id}
              node={node}
              scope="body"
              answers={answers}
              templateData={props.templateData}
              inspectionId={props.inspectionId}
              onCommit={commit}
            />
          ))
        )}
      </div>

      {/* Missing required-fields dialog */}
      <Dialog open={missingDialogOpen} onOpenChange={setMissingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Missing required answers</DialogTitle>
            <DialogDescription>
              {missingItems.length} required item
              {missingItems.length === 1 ? "" : "s"} {missingItems.length === 1 ? "doesn’t" : "don’t"} have an answer yet.
              Complete them before submitting, or submit anyway with the
              defaults blank.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[40vh] space-y-1 overflow-y-auto py-2 text-sm">
            {missingItems.map((it) => (
              <li
                key={it.item_id}
                className="rounded-md border bg-muted/40 px-3 py-1.5"
              >
                {it.label || "(unlabeled)"}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setMissingDialogOpen(false)}
              disabled={submitting}
            >
              Back to inspection
            </Button>
            <Button
              variant="default"
              onClick={proceedToFlaggedReview}
              disabled={submitting}
            >
              Submit anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flagged-items wizard */}
      <Dialog open={flaggedDialogOpen} onOpenChange={setFlaggedDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertTriangle className="mr-1.5 inline-block h-4 w-4 text-warning" />
              Flagged items detected
              <InfoTooltip tip="flagged_response_finding" />
            </DialogTitle>
            <DialogDescription>
              These responses will become open findings on submit. Add a
              comment so the EHS team has context — they can mark resolved or
              escalate to an incident from there.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2">
            <ul className="space-y-3">
              {findFailedAnswers(props.items, answers).map(({ item, answer }) => (
                <li
                  key={item.item_id}
                  className="rounded-md border border-destructive/30 bg-destructive/5 p-3"
                >
                  <p className="text-sm font-medium">
                    {item.label}{" "}
                    <span className="ml-1 text-xs font-normal italic text-destructive">
                      ({answer.selected_option_label ?? "Failed"})
                    </span>
                  </p>
                  <Textarea
                    rows={2}
                    placeholder="What was the cause? What's the immediate action?"
                    value={flaggedComments[item.item_id] ?? ""}
                    onChange={(e) =>
                      setFlaggedComments((p) => ({
                        ...p,
                        [item.item_id]: e.target.value,
                      }))
                    }
                    className="mt-2"
                    maxLength={1000}
                  />
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setFlaggedDialogOpen(false)}
              disabled={submitting}
            >
              Back
            </Button>
            <Button onClick={submitNow} disabled={submitting}>
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {submitting ? "Submitting..." : "Submit inspection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recursive node renderer
// ---------------------------------------------------------------------------
function RunnerNode({
  node,
  scope,
  answers,
  templateData,
  inspectionId,
  onCommit,
}: {
  node: ItemTreeNode;
  scope: "header" | "body";
  answers: AnswerMap;
  templateData: TemplateData;
  inspectionId: string;
  onCommit: (scope: "header" | "body", itemId: string, a: InspectionAnswer) => void;
}) {
  const item = node.item;

  if (item.type === "section") {
    return (
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">{item.label}</h2>
        {node.children.length > 0 && (
          <div className="mt-3 space-y-4">
            {node.children.map((c) => (
              <RunnerNode
                key={c.item.item_id}
                node={c}
                scope={scope}
                answers={answers}
                templateData={templateData}
                inspectionId={inspectionId}
                onCommit={onCommit}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  if (item.type === "category") {
    return (
      <div className="rounded-md border-l-2 border-primary/30 pl-3">
        <h3 className="text-sm font-semibold">{item.label}</h3>
        {node.children.length > 0 && (
          <div className="mt-2 space-y-3">
            {node.children.map((c) => (
              <RunnerNode
                key={c.item.item_id}
                node={c}
                scope={scope}
                answers={answers}
                templateData={templateData}
                inspectionId={inspectionId}
                onCommit={onCommit}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (item.type === "information") {
    return (
      <div className="rounded-md border-l-4 border-primary/40 bg-primary/5 p-3 text-sm">
        {item.label}
      </div>
    );
  }

  return (
    <RunnerItem
      item={item}
      scope={scope}
      answer={answers[item.item_id]}
      templateData={templateData}
      inspectionId={inspectionId}
      onCommit={(a) => onCommit(scope, item.item_id, a)}
    />
  );
}

function RunnerItem({
  item,
  scope: _scope,
  answer,
  templateData,
  inspectionId,
  onCommit,
}: {
  item: TemplateNodeItem;
  scope: "header" | "body";
  answer: InspectionAnswer | undefined;
  templateData: TemplateData;
  inspectionId: string;
  onCommit: (a: InspectionAnswer) => void;
}) {
  const required = (item.options?.is_mandatory as boolean) ?? false;
  const hasAns = hasAnswer(answer);

  if (!isMvpType(item.type)) {
    return (
      <div className="rounded-md border border-dashed border-warning/50 bg-warning/5 p-3 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">
              Item type <code className="font-mono">{item.type}</code> is not
              supported in this version. Skipped automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isNonAnswerable(item.type)) return null;

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border bg-background p-3",
        hasAns && "border-success/30",
        required && !hasAns && "border-warning/40"
      )}
    >
      <label className="text-sm font-medium">
        {item.label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <RunnerInput
        item={item}
        answer={answer}
        templateData={templateData}
        inspectionId={inspectionId}
        onCommit={onCommit}
      />
    </div>
  );
}

function RunnerInput({
  item,
  answer,
  templateData,
  inspectionId,
  onCommit,
}: {
  item: TemplateNodeItem;
  answer: InspectionAnswer | undefined;
  templateData: TemplateData;
  inspectionId: string;
  onCommit: (a: InspectionAnswer) => void;
}) {
  // Question (single-select from answer_set)
  if (item.type === "question") {
    const setId = item.options?.answer_set as string | undefined;
    const set = resolveAnswerSet(templateData, setId);
    if (!set) {
      return (
        <p className="text-xs italic text-muted-foreground">
          No answer set linked to this question — ask the template author to fix.
        </p>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {set.responses.map((r) => {
          const isSelected = answer?.selected_option_id === r.id;
          const baseClasses =
            "inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium transition";
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onCommit(buildQuestionAnswer(templateData, setId, r.id, answer?.notes))}
              className={cn(
                baseClasses,
                isSelected
                  ? r.failed
                    ? "border-destructive bg-destructive text-destructive-foreground"
                    : "border-success bg-success/15 text-success"
                  : "bg-background hover:bg-accent"
              )}
              style={
                !isSelected && r.colour
                  ? { borderColor: `rgb(${r.colour})`, color: `rgb(${r.colour})` }
                  : undefined
              }
            >
              {r.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (item.type === "text") {
    return (
      <textarea
        rows={3}
        defaultValue={answer?.response_text ?? ""}
        onBlur={(e) => onCommit(buildTextAnswer(e.target.value))}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        maxLength={5000}
      />
    );
  }

  if (item.type === "datetime") {
    const v = (answer?.response_value as { value?: string })?.value ?? "";
    const local = v ? v.slice(0, 16) : "";
    return (
      <input
        type="datetime-local"
        defaultValue={local}
        onBlur={(e) => {
          if (!e.target.value) return;
          const iso = new Date(e.target.value).toISOString();
          onCommit(buildDateTimeAnswer(iso));
        }}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:w-auto"
      />
    );
  }

  if (item.type === "signature") {
    const saved = !!(answer?.uploads && answer.uploads.length > 0);
    const initialName = (answer?.response_value as { value?: string })?.value;
    return (
      <SignatureCanvas
        initialName={initialName}
        saved={saved}
        onClear={() => onCommit({ updated_at: new Date().toISOString() })}
        onSave={async ({ name, blob }) => {
          // Upload the PNG, attach it, then commit the answer payload.
          const supabase = createClient();
          const path = `${inspectionId}/${crypto.randomUUID()}.png`;
          const { error: upErr } = await supabase.storage
            .from("inspection-uploads")
            .upload(path, blob, { contentType: "image/png" });
          if (upErr) throw upErr;
          const { attachInspectionUpload } = await import(
            "@/app/(app)/inspections/actions"
          );
          const res = await attachInspectionUpload({
            inspection_id: inspectionId,
            item_id: item.item_id,
            storage_path: path,
            file_name: `signature-${name}.png`,
            mime_type: "image/png",
            size_bytes: blob.size,
          });
          if (!res.ok) throw new Error(res.error);
          onCommit(
            buildSignatureAnswer({
              name,
              upload_id: res.data!.id,
              storage_path: path,
            })
          );
        }}
      />
    );
  }

  if (item.type === "media") {
    return (
      <MediaUploader
        inspectionId={inspectionId}
        itemId={item.item_id}
        uploads={answer?.uploads ?? []}
        onChange={(next) =>
          onCommit({ ...(answer ?? {}), uploads: next, updated_at: new Date().toISOString() })
        }
      />
    );
  }

  // Sections / categories / information are handled at RunnerNode level.
  return null;
}
