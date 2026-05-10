"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Hand, Sparkles } from "lucide-react";
import { acknowledgeStopWork } from "@/lib/actions/stop-work";
import type { ActionResult } from "@/lib/incidents/schemas";

export type ActiveStopWork = {
  id: string;
  ref_code: string | null;
  title: string | null;
  reason: string | null;
  raised_at: string | null;
  raised_by: string | null;
  site_id: string;
  site_name: string | null;
};

/**
 * Sticky alert banner that surfaces active stop-works (incidents.stop_work=true
 * with no acknowledgement). Sits below the regulatory banner. Cyan-tinted
 * to mark Argus origin (Phase 9b — most stop-works will come from the
 * Copilot's `raise_stop_work` tool call), but workers can also raise stop-work
 * manually from the incident detail page (path lands in 9d alongside the
 * magic-wands).
 *
 * Acknowledgement is a one-click affordance — flips `stop_work_acknowledged_at`
 * and `_by`. The incident itself stays `stop_work=true` for audit purposes;
 * un-acknowledging or re-raising is out of scope for v1 (revisit when we
 * model lift criteria + photo proof on lift in v2).
 */
export function StopWorkBanner({ active }: { active: ActiveStopWork[] }) {
  if (active.length === 0) return null;
  const top = active[0];

  return (
    <div
      className="sticky top-14 z-20 border-b px-4 py-2 text-sm"
      style={{
        borderColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 50%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--argus-accent, #00D4FF) 8%, transparent)",
      }}
    >
      <div className="flex items-start gap-3">
        <Hand className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--argus-accent, #00D4FF)" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <span>Stop-work raised</span>
            {top.site_name && <span className="text-foreground/60">· {top.site_name}</span>}
            <Sparkles className="h-3 w-3" style={{ color: "var(--argus-accent, #00D4FF)" }} aria-label="Raised via Argus" />
          </div>
          {top.reason && <div className="text-xs text-foreground/80 max-w-3xl">{top.reason}</div>}
          <Link
            href={`/incidents/${top.id}`}
            className="mt-0.5 inline-block text-xs underline underline-offset-2 hover:no-underline"
          >
            View {top.ref_code ?? "incident"}
          </Link>
          {active.length > 1 && (
            <p className="mt-1 text-xs text-muted-foreground">
              + {active.length - 1} other active stop-work{active.length === 2 ? "" : "s"}
            </p>
          )}
        </div>
        <AcknowledgeButton id={top.id} />
      </div>
    </div>
  );
}

function AcknowledgeButton({ id }: { id: string }) {
  const [, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    acknowledgeStopWork,
    null,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="incident_id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
      >
        {isPending ? "…" : "Acknowledge"}
      </button>
    </form>
  );
}
