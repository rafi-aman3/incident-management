"use client";

import { useState, useTransition } from "react";
import { AlertOctagon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  resolveFinding,
  escalateFindingToIncident,
} from "@/app/(app)/inspections/findings-actions";
import type { FindingStatus } from "@/lib/templates/types";

export function FindingActionsCard({
  findingId,
  status,
  canResolve,
  canEscalate,
}: {
  findingId: string;
  status: FindingStatus;
  canResolve: boolean;
  canEscalate: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");

  const finalized = status === "resolved" || status === "escalated_to_incident";

  function handleResolve() {
    startTransition(async () => {
      const res = await resolveFinding({ finding_id: findingId, notes });
      if (!res.ok) toast.error(res.error);
      else toast.success("Finding resolved");
    });
  }
  function handleEscalate() {
    startTransition(async () => {
      const res = await escalateFindingToIncident(findingId);
      if (res && res.ok === false) toast.error(res.error);
      // On success the action redirects to /incidents/<id>
    });
  }

  if (finalized) {
    return (
      <div className="rounded-md border border-success/30 bg-success/5 p-4 text-sm">
        This finding is finalized — no further action is available.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Take action</h3>
      <div>
        <label htmlFor="resolution-notes" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Resolution notes (optional)
        </label>
        <Textarea
          id="resolution-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What was the immediate action? Who confirmed?"
          className="mt-1"
          maxLength={2000}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={handleResolve}
          disabled={pending || !canResolve}
          variant="default"
        >
          <CheckCircle2 className="mr-1 h-3 w-3" />
          {pending ? "Working..." : "Mark resolved"}
        </Button>
        <Button
          type="button"
          onClick={handleEscalate}
          disabled={pending || !canEscalate}
          variant="outline"
        >
          <AlertOctagon className="mr-1 h-3 w-3" />
          Escalate to incident
        </Button>
      </div>
      {!canResolve && !canEscalate && (
        <p className="text-xs text-muted-foreground">
          You don&apos;t have permission to resolve or escalate findings on this
          site.
        </p>
      )}
    </div>
  );
}
