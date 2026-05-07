"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { saveInvestigationText } from "@/app/(app)/investigations/[id]/actions";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function FindingsEditor({
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
      field: "findings",
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
            Findings
          </p>
          <h2 className="text-base font-semibold">
            Free-text narrative — what happened, what we learned
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Autosaves 1 second after you stop typing. Plain text for v1; markdown later.
          </p>
        </div>
        {status !== "idle" &&
          (status === "error" ? (
            <span className="inline-flex items-center gap-2 text-[11px]">
              <span className="text-destructive">Save failed</span>
              <button
                type="button"
                onClick={() => void persist(value)}
                className="rounded border border-destructive/30 px-1.5 py-0.5 font-medium text-destructive hover:bg-destructive/10"
              >
                Retry
              </button>
            </span>
          ) : (
            <span
              className={cn(
                "text-[11px] tabular-nums text-muted-foreground",
              )}
            >
              {status === "saving" && "Saving…"}
              {status === "saved" && "Saved"}
            </span>
          ))}
      </div>
      <div className="p-4">
        <Textarea
          value={value}
          disabled={readOnly}
          onChange={(e) => setValue(e.target.value)}
          rows={14}
          maxLength={20000}
          placeholder="Document the timeline, contributing factors, and the team's conclusion. Anything not captured in the 5-Why chain or root cause summary belongs here."
        />
      </div>
    </div>
  );
}
