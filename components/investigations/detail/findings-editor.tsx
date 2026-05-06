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

  useEffect(() => {
    if (value === lastSaved.current) return;
    setStatus("saving");
    const t = window.setTimeout(async () => {
      const result = await saveInvestigationText({
        investigation_id: investigationId,
        field: "findings",
        value,
      });
      if (result.ok) {
        setStatus("saved");
        lastSaved.current = value;
        window.setTimeout(() => setStatus("idle"), 1500);
      } else {
        setStatus("error");
      }
    }, 1000);
    return () => window.clearTimeout(t);
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
        {status !== "idle" && (
          <span
            className={cn(
              "text-[11px] tabular-nums",
              status === "error" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {status === "saving" && "Saving…"}
            {status === "saved" && "Saved"}
            {status === "error" && "Save failed"}
          </span>
        )}
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
