import Link from "next/link";
import { format } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

export type ActivityEvent = {
  id: string;
  verb: string;
  payload: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
  /** Optional deep-link to the source record (varies by verb). */
  href: string | null;
};

const VERB_LABELS: Record<string, string> = {
  "incident.classified": "classified the incident",
  "incident.severity_overridden": "overrode severity",
  "incident.assigned": "assigned a triage owner",
  "incident.escalated": "escalated to investigation",
  "incident.closed": "closed the incident",
  "investigation.advanced": "moved the investigation forward",
  "investigation.lead_reassigned": "reassigned the investigation lead",
  "investigation.closed_no_capa": "closed the investigation — no CAPA",
  "investigation.closed_with_capa": "closed the investigation and assigned a CAPA",
  "evidence.uploaded": "uploaded evidence",
  "evidence.deleted": "deleted evidence",
  "witness.statement_added": "added a witness statement",
  "capa.created": "created a CAPA",
  "capa.completed": "marked CAPA complete",
  "capa.verified": "verified CAPA closure",
  "capa.verification_partial": "marked CAPA partially effective",
  "capa.reassigned_verifier": "reassigned CAPA verifier",
  "notification.fired": "sent a notification",
};

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nothing has happened yet.
      </div>
    );
  }

  // Group by yyyy-MM-dd in reverse-chrono order — events are pre-sorted desc.
  const days: Array<{ key: string; label: string; events: ActivityEvent[] }> = [];
  for (const e of events) {
    const d = new Date(e.created_at);
    const key = format(d, "yyyy-MM-dd");
    const last = days[days.length - 1];
    if (last && last.key === key) {
      last.events.push(e);
    } else {
      days.push({ key, label: format(d, "EEEE, MMM d"), events: [e] });
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Timeline</p>
        <h2 className="text-base font-semibold">{events.length} events</h2>
      </div>
      <div className="divide-y">
        {days.map((day) => (
          <section key={day.key}>
            <header className="bg-muted/30 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {day.label}
            </header>
            <ol className="divide-y">
              {day.events.map((e) => {
                const label = VERB_LABELS[e.verb] ?? e.verb;
                const detail = renderDetail(e.verb, e.payload);
                const actor = e.actor_name ?? "System";
                return (
                  <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {computeInitials(actor)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{actor}</span>{" "}
                        <span className="text-muted-foreground">{label}</span>
                        {detail && (
                          <span className="text-muted-foreground"> — {detail}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {e.href && (
                      <Link
                        href={e.href}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Open source record"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function renderDetail(verb: string, payload: Record<string, unknown>): string | null {
  if (verb === "incident.classified") {
    const sev = payload.severity as string | undefined;
    const track = payload.track as string | undefined;
    if (sev && track) return `${sev} · Track ${track}`;
  }
  if (verb === "investigation.advanced") {
    const from = payload.from as string | undefined;
    const to = payload.to as string | undefined;
    if (from && to) return `${from} → ${to}`;
  }
  if (verb === "evidence.uploaded" || verb === "evidence.deleted") {
    const fn = payload.file_name as string | undefined;
    return fn ?? null;
  }
  if (verb === "witness.statement_added") {
    const name = payload.name as string | undefined;
    return name ?? null;
  }
  if (verb === "capa.verified" || verb === "capa.verification_partial") {
    const result = payload.verification_result as string | undefined;
    return result ?? null;
  }
  if (verb === "notification.fired") {
    const kind = payload.kind as string | undefined;
    return kind ?? null;
  }
  return null;
}

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
