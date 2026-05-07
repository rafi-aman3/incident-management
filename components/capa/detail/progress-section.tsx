"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
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

  const save = useCallback(
    async (next: number) => {
      setStatus("saving");
      const result = await updateCapaProgress({ capa_id: capaId, pct: next });
      if (result.ok) {
        setStatus("saved");
        lastSaved.current = next;
        if (result.data?.promoted) {
          toast.success("CAPA started", {
            description: "Status moved to In progress.",
          });
        }
        window.setTimeout(() => setStatus("idle"), 1200);
      } else {
        setStatus("error");
        toast.error(result.error);
      }
    },
    [capaId],
  );

  useEffect(() => {
    if (pct === lastSaved.current) return;
    if (readOnly) return;
    const t = window.setTimeout(() => void save(pct), 500);
    return () => window.clearTimeout(t);
  }, [pct, readOnly, save]);

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
        <div className="flex items-center gap-2">
          <SaveIndicator status={status} />
          {status === "error" && !readOnly && (
            <button
              type="button"
              onClick={() => void save(pct)}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium hover:bg-accent"
            >
              <RotateCcw className="h-3 w-3" /> Retry
            </button>
          )}
        </div>
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
