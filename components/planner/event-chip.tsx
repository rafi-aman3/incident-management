import Link from "next/link";
import {
  AlertOctagon,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  ListChecks,
  Play,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import type { PlannerEvent, PlannerEventKind } from "@/lib/planner/types";
import { cn } from "@/lib/utils";

const ICONS: Record<PlannerEventKind, LucideIcon> = {
  incident: AlertOctagon,
  inspection_started: Play,
  inspection_completed: ClipboardCheck,
  capa_due: ListChecks,
  asset_pm_due: Boxes,
  investigation_due: ClipboardList,
  regulatory_deadline: ShieldCheck,
};

const SEVERITY_TONE: Record<string, string> = {
  S1: "bg-sev-1 text-white border-transparent",
  S2: "bg-sev-2 text-white border-transparent",
  S3: "bg-sev-3 text-foreground border-transparent",
  S4: "bg-sev-4 text-white border-transparent",
  S5: "bg-sev-5 text-foreground border-transparent",
};

const BRAND_TONE = "bg-brand-soft text-brand border-brand/20";
const BRAND_BOLD_TONE = "bg-brand text-white border-transparent";
const AMBER_TONE = "bg-warning/20 text-foreground border-warning/40";
const DESTRUCTIVE_TONE = "bg-destructive/15 text-destructive border-destructive/30";
const SUCCESS_TONE = "bg-success/15 text-success border-success/30";

function toneFor(event: PlannerEvent): string {
  if (event.kind === "incident") {
    return SEVERITY_TONE[event.severity ?? "S5"] ?? SEVERITY_TONE.S5;
  }
  if (event.kind === "inspection_completed") {
    return event.is_failed ? DESTRUCTIVE_TONE : SUCCESS_TONE;
  }
  if (event.kind === "capa_due" || event.kind === "asset_pm_due") {
    return event.is_overdue ? DESTRUCTIVE_TONE : AMBER_TONE;
  }
  if (event.kind === "investigation_due") {
    return event.is_overdue ? DESTRUCTIVE_TONE : BRAND_TONE;
  }
  if (event.kind === "regulatory_deadline") return BRAND_BOLD_TONE;
  return BRAND_TONE;
}

/**
 * Single chip primitive used by all 3 planner views.
 *   - size="sm": compact pill for month-grid cells (icon + truncated title)
 *   - size="md": full-width row for week / day views (icon + time + title + site)
 *
 * Always wraps in <Link href={event.href}> — chip is the click target.
 */
export function EventChip({
  event,
  size = "sm",
}: {
  event: PlannerEvent;
  size?: "sm" | "md";
}) {
  const Icon = ICONS[event.kind];
  const tone = toneFor(event);
  const time = format(new Date(event.date), "h:mm a");
  const fullLabel = `${event.title} — ${format(new Date(event.date), "PP p")}${event.site_name ? ` · ${event.site_name}` : ""}`;

  if (size === "sm") {
    return (
      <Link
        href={event.href}
        title={fullLabel}
        className={cn(
          "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-none",
          "hover:brightness-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          tone,
        )}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{event.title}</span>
      </Link>
    );
  }

  return (
    <Link
      href={event.href}
      className={cn(
        "flex items-center gap-2 rounded border px-2 py-1.5 text-xs",
        "hover:brightness-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        tone,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="w-12 shrink-0 font-mono text-[10px] uppercase opacity-80">
        {time}
      </span>
      <span className="truncate font-medium">{event.title}</span>
      {event.site_name ? (
        <span className="ml-auto shrink-0 text-[10px] opacity-70">{event.site_name}</span>
      ) : null}
    </Link>
  );
}
