"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateCapaProgress } from "@/app/(app)/capa/[id]/actions";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function CapaProgressSection({
  capaId,
  initialPct,
  readOnly,
  hint,
}: {
  capaId: string;
  initialPct: number;
  readOnly: boolean;
  hint?: string;
}) {
  const [pct, setPct] = useState(initialPct);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const lastSaved = useRef(initialPct);

  useEffect(() => {
    if (pct === lastSaved.current) return;
    if (readOnly) return;
    setStatus("saving");
    const t = window.setTimeout(async () => {
      const result = await updateCapaProgress({ capa_id: capaId, pct });
      if (result.ok) {
        setStatus("saved");
        lastSaved.current = pct;
        window.setTimeout(() => setStatus("idle"), 1200);
      } else {
        setStatus("error");
        toast.error(result.error);
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [capaId, pct, readOnly]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Implementation progress
          </p>
          <h2 className="text-base font-semibold">{pct}% complete</h2>
          {hint && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
          )}
        </div>
        <SaveIndicator status={status} />
      </div>
      <div className="space-y-3 px-4 py-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          disabled={readOnly}
          onChange={(e) => setPct(Number(e.target.value))}
          className={cn(
            "w-full cursor-pointer accent-primary",
            readOnly && "cursor-not-allowed opacity-50"
          )}
          aria-label="Implementation progress"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
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
  );
}
