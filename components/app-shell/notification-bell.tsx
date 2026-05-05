"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  capa_escalated: "normal",
  assigned: "normal",
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
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">All caught up.</p>
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
  const [, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    resolveNotification,
    null
  );

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
            priority === "high" ? "bg-destructive" : "bg-warning"
          }`}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight">{notification.title}</div>
          {notification.body && (
            <p className="text-xs text-muted-foreground">{notification.body}</p>
          )}
          {notification.deadline_at && <Countdown deadline={notification.deadline_at} />}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pl-4">
        {notification.incident_id && (
          <Link
            href={`/incidents/${notification.incident_id}`}
            className="text-xs text-primary hover:underline"
          >
            Open incident
          </Link>
        )}
        <form action={formAction}>
          <input type="hidden" name="notification_id" value={notification.id} />
          <button
            type="submit"
            disabled={isPending}
            className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
          >
            Mark notified
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
