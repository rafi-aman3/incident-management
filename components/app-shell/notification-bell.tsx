"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Bell,
  AlertOctagon,
  AlertTriangle,
  Clock,
  ListChecks,
  Flag,
  Stethoscope,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { resolveNotification } from "@/lib/actions/onboarding";
import type { ActionResult } from "@/lib/incidents/schemas";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  deadline_at: string | null;
  incident_id: string | null;
  capa_id: string | null;
  created_at: string | null;
};

const KIND_PRIORITY: Record<string, "high" | "normal"> = {
  osha_8hr: "high",
  osha_24hr: "high",
  riddor_immediate: "high",
  riddor_disease: "high",
  riddor_f2508_10d: "normal",
  riddor_7day: "normal",
  capa_overdue: "normal",
  capa_escalated: "high", // 3+ days late — escalate to high
  assigned: "normal",
};

const KIND_ICON: Record<string, LucideIcon> = {
  osha_8hr: AlertOctagon,
  osha_24hr: AlertOctagon,
  riddor_immediate: Flag,
  riddor_disease: Stethoscope,
  riddor_f2508_10d: Flag,
  riddor_7day: CalendarClock,
  capa_overdue: AlertTriangle,
  capa_escalated: AlertTriangle,
  assigned: ListChecks,
};

const KIND_LABEL: Record<string, string> = {
  osha_8hr: "OSHA 8h",
  osha_24hr: "OSHA 24h",
  riddor_immediate: "RIDDOR",
  riddor_disease: "RIDDOR",
  riddor_f2508_10d: "F2508",
  riddor_7day: "F2508 (7d)",
  capa_overdue: "Overdue",
  capa_escalated: "Escalated",
  assigned: "Assigned",
};

export function NotificationBell({ notifications }: { notifications: NotificationItem[] }) {
  const count = notifications.length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <p className="flex items-center justify-center gap-1.5 px-3 py-6 text-center text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" /> All caught up.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id} className="px-3 py-2">
                <Row notification={n} />
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Row({ notification }: { notification: NotificationItem }) {
  const priority = KIND_PRIORITY[notification.kind] ?? "normal";
  const Icon = KIND_ICON[notification.kind] ?? Bell;
  const label = KIND_LABEL[notification.kind] ?? notification.kind;
  const [, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    resolveNotification,
    null
  );

  // Capa-related kinds deep-link to /capa/[id]; otherwise fall back to
  // /incidents/[id]. The link target adapts to the kind so the bell click
  // always lands the user on the right page to act.
  const isCapaKind =
    notification.kind === "capa_overdue" ||
    notification.kind === "capa_escalated" ||
    (notification.kind === "assigned" && !!notification.capa_id);

  const linkHref = isCapaKind && notification.capa_id
    ? `/capa/${notification.capa_id}`
    : notification.incident_id
      ? `/incidents/${notification.incident_id}`
      : null;
  const linkLabel = isCapaKind ? "Open CAPA" : "Open incident";

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <Icon
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
            priority === "high" ? "text-destructive" : "text-warning"
          }`}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
          </div>
          <div className="mt-0.5 text-sm font-medium leading-tight">{notification.title}</div>
          {notification.body && (
            <p className="text-xs text-muted-foreground">{notification.body}</p>
          )}
          {notification.deadline_at && <Countdown deadline={notification.deadline_at} />}
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 pl-4">
        {linkHref && (
          <Link href={linkHref} className="text-xs text-primary hover:underline">
            {linkLabel}
          </Link>
        )}
        <form action={formAction}>
          <input type="hidden" name="notification_id" value={notification.id} />
          <button
            type="submit"
            disabled={isPending}
            className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
          >
            <Clock className="mr-0.5 inline h-3 w-3" /> Mark resolved
          </button>
        </form>
      </div>
    </div>
  );
}

function Countdown({ deadline }: { deadline: string }) {
  const due = new Date(deadline).getTime();
  const now = Date.now();
  const diff = due - now;
  const past = diff < 0;
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  return (
    <div className={`mt-0.5 font-mono text-[10px] ${past ? "text-destructive" : "text-muted-foreground"}`}>
      {past ? `OVERDUE by ${hours}h ${minutes}m` : `${hours}h ${minutes}m remaining`}
    </div>
  );
}
