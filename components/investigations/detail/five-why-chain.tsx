"use client";

import { useEffect, useRef, useState } from "react";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveWhy, saveInvestigationText } from "@/app/(app)/investigations/[id]/actions";

export type WhyRow = {
  level: number;
  question: string;
  answer: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function FiveWhyChain({
  investigationId,
  initialWhys,
  initialRootCause,
  readOnly,
}: {
  investigationId: string;
  initialWhys: WhyRow[];
  initialRootCause: string;
  readOnly: boolean;
}) {
  const seeded: WhyRow[] = Array.from({ length: 5 }, (_, i) => {
    const level = i + 1;
    const existing = initialWhys.find((w) => w.level === level);
    return {
      level,
      question: existing?.question ?? "",
      answer: existing?.answer ?? "",
    };
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            5-Why analysis
          </p>
          <h2 className="text-base font-semibold">
            Drill from the immediate cause to the root cause
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Each row autosaves 1 second after you stop typing. Why-5 is the root cause.
          </p>
        </div>
        <ul className="divide-y">
          {seeded.map((row) => (
            <WhyRowEditor
              key={row.level}
              investigationId={investigationId}
              initial={row}
              readOnly={readOnly}
            />
          ))}
        </ul>
      </div>

      <RootCauseSummary
        investigationId={investigationId}
        initial={initialRootCause}
        readOnly={readOnly}
      />
    </div>
  );
}

function WhyRowEditor({
  investigationId,
  initial,
  readOnly,
}: {
  investigationId: string;
  initial: WhyRow;
  readOnly: boolean;
}) {
  const [question, setQuestion] = useState(initial.question);
  const [answer, setAnswer] = useState(initial.answer);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const lastSaved = useRef({ question: initial.question, answer: initial.answer });

  const persist = async (q: string, a: string) => {
    setStatus("saving");
    const result = await saveWhy({
      investigation_id: investigationId,
      level: initial.level,
      question: q,
      answer: a,
    });
    if (result.ok) {
      setStatus("saved");
      lastSaved.current = { question: q, answer: a };
      window.setTimeout(() => setStatus("idle"), 1500);
    } else {
      setStatus("error");
    }
  };

  useEffect(() => {
    if (
      question === lastSaved.current.question &&
      answer === lastSaved.current.answer
    ) {
      return;
    }
    const t = window.setTimeout(() => {
      void persist(question, answer);
    }, 1000);
    setStatus("saving");
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investigationId, initial.level, question, answer]);

  const isRoot = initial.level === 5;

  return (
    <li className={cn("space-y-2 px-4 py-3", isRoot && "bg-primary/5")}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
            isRoot
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {initial.level}
        </span>
        <span className="text-sm font-medium">Why #{initial.level}</span>
        {isRoot && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
            <Target className="h-2.5 w-2.5" /> Root cause
          </span>
        )}
        <SaveIndicator
          status={status}
          onRetry={() => void persist(question, answer)}
          className="ml-auto"
        />
      </div>
      <div className="space-y-2">
        <div>
          <Label htmlFor={`why-q-${initial.level}`} className="text-[11px] text-muted-foreground">
            Question
          </Label>
          <Input
            id={`why-q-${initial.level}`}
            value={question}
            disabled={readOnly}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              initial.level === 1
                ? "Why did this happen?"
                : `Why did the answer to Why #${initial.level - 1} happen?`
            }
            maxLength={2000}
          />
        </div>
        <div>
          <Label htmlFor={`why-a-${initial.level}`} className="text-[11px] text-muted-foreground">
            Answer
          </Label>
          <Textarea
            id={`why-a-${initial.level}`}
            value={answer}
            disabled={readOnly}
            onChange={(e) => setAnswer(e.target.value)}
            rows={2}
            maxLength={5000}
          />
        </div>
      </div>
    </li>
  );
}

function RootCauseSummary({
  investigationId,
  initial,
  readOnly,
}: {
  investigationId: string;
  initial: string;
  readOnly: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const lastSaved = useRef(initial);

  const persist = async (v: string) => {
    setStatus("saving");
    const result = await saveInvestigationText({
      investigation_id: investigationId,
      field: "root_cause_summary",
      value: v,
    });
    if (result.ok) {
      setStatus("saved");
      lastSaved.current = v;
      window.setTimeout(() => setStatus("idle"), 1500);
    } else {
      setStatus("error");
    }
  };

  useEffect(() => {
    if (value === lastSaved.current) return;
    const t = window.setTimeout(() => {
      void persist(value);
    }, 1000);
    setStatus("saving");
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investigationId, value]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Root cause summary
          </p>
          <h2 className="text-sm font-semibold">
            Plain-English statement of the underlying cause
          </h2>
        </div>
        <SaveIndicator status={status} onRetry={() => void persist(value)} />
      </div>
      <div className="p-4">
        <Textarea
          value={value}
          disabled={readOnly}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          maxLength={20000}
          placeholder="Summarize the root cause from the chain above. This is what regulators and stakeholders read."
        />
      </div>
    </div>
  );
}

function SaveIndicator({
  status,
  onRetry,
  className,
}: {
  status: SaveStatus;
  onRetry?: () => void;
  className?: string;
}) {
  if (status === "idle") return null;
  if (status === "error") {
    return (
      <span className={cn("inline-flex items-center gap-2 text-[11px]", className)}>
        <span className="text-destructive">Save failed</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-destructive/30 px-1.5 py-0.5 font-medium text-destructive hover:bg-destructive/10"
          >
            Retry
          </button>
        )}
      </span>
    );
  }
  return (
    <span className={cn("text-[11px] tabular-nums text-muted-foreground", className)}>
      {status === "saving" && "Saving…"}
      {status === "saved" && "Saved"}
    </span>
  );
}
