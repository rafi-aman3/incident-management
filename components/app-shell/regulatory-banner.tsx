"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { AlertOctagon } from "lucide-react";
import { resolveNotification } from "@/lib/actions/onboarding";
import type { ActionResult } from "@/lib/incidents/schemas";

export type ActiveDeadline = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  deadline_at: string | null;
  incident_id: string | null;
};

const HIGH_PRIORITY = new Set([
  "osha_8hr",
  "osha_24hr",
  "riddor_immediate",
  "riddor_disease",
]);

/**
 * Sticky banner under the topbar. Mounts when at least one unresolved
 * high-priority notification exists for the current site. Live-updates the
 * countdown each minute.
 */
export function RegulatoryBanner({ deadlines }: { deadlines: ActiveDeadline[] }) {
  const highPriority = deadlines.filter((d) => HIGH_PRIORITY.has(d.kind));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (highPriority.length === 0) return null;
  // Show the closest-to-deadline first
  const sorted = [...highPriority].sort((a, b) => {
    const ad = a.deadline_at ? new Date(a.deadline_at).getTime() : Infinity;
    const bd = b.deadline_at ? new Date(b.deadline_at).getTime() : Infinity;
    return ad - bd;
  });
  const top = sorted[0];

  return (
    <div
      className="sticky top-14 z-20 border-b border-destructive/40 px-4 py-2 text-sm"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--destructive) 10%, var(--background))",
      }}
    >
      <div className="flex items-start gap-3">
        <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-destructive">{top.title}</div>
          {top.body && <div className="text-xs text-foreground/80">{top.body}</div>}
          {top.deadline_at && <Countdown deadline={top.deadline_at} now={now} />}
          {sorted.length > 1 && (
            <p className="mt-1 text-xs text-muted-foreground">
              + {sorted.length - 1} other unresolved {sorted.length === 2 ? "deadline" : "deadlines"}
            </p>
          )}
        </div>
        <ResolveButton id={top.id} />
      </div>
    </div>
  );
}

function Countdown({ deadline, now }: { deadline: string; now: number }) {
  const due = new Date(deadline).getTime();
  const diff = due - now;
  const past = diff < 0;
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  return (
    <div
      className={`mt-0.5 text-xs font-mono ${past ? "text-destructive" : "text-foreground/70"}`}
      aria-live="polite"
    >
      {past
        ? `OVERDUE by ${hours}h ${minutes}m`
        : `${hours}h ${minutes}m remaining`}
    </div>
  );
}

function ResolveButton({ id }: { id: string }) {
  const [, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    resolveNotification,
    null
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="notification_id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
      >
        {isPending ? "…" : "Mark notified"}
      </button>
    </form>
  );
}
