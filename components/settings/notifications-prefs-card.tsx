"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setNotificationSilence } from "@/app/(app)/settings/actions";

export type NotificationKindRow = {
  kind: string;
  label: string;
  description: string;
};

type Group = {
  heading: string;
  rationale?: string;
  rows: ReadonlyArray<NotificationKindRow>;
  /** When true the entire group is non-silenceable (life-safety). */
  protected: boolean;
};

export const NOTIFICATION_GROUPS: ReadonlyArray<Group> = [
  {
    heading: "Regulatory clock",
    rationale: "Life-safety and compliance windows. Can't be silenced.",
    protected: true,
    rows: [
      { kind: "osha_8hr", label: "OSHA 8-hour fatality", description: "Fatality must be reported within 8 hours." },
      { kind: "osha_24hr", label: "OSHA 24-hour amputation / hospitalization", description: "Required within 24 hours." },
      { kind: "riddor_immediate", label: "RIDDOR immediate", description: "Major injury / dangerous occurrence." },
      { kind: "riddor_f2508_10d", label: "RIDDOR F2508 (10 days)", description: "Specified injury form deadline." },
      { kind: "riddor_7day", label: "RIDDOR over-7-day injury", description: "Worker absent > 7 days." },
      { kind: "riddor_disease", label: "RIDDOR disease", description: "Reportable occupational disease." },
    ],
  },
  {
    heading: "Stop-work",
    rationale: "Live safety hold. Can't be silenced.",
    protected: true,
    rows: [
      { kind: "stop_work_raised", label: "Stop-work raised", description: "Someone has halted work on a site you can access." },
    ],
  },
  {
    heading: "Investigation & CAPA",
    protected: false,
    rows: [
      { kind: "capa_overdue", label: "CAPA overdue", description: "An action assigned to you is past its due date." },
      { kind: "capa_escalated", label: "CAPA escalated", description: "An action under your verification is 3+ days late." },
    ],
  },
  {
    heading: "Assignment",
    protected: false,
    rows: [
      { kind: "assigned", label: "Assigned to me", description: "You've been named owner, verifier, or investigator." },
      { kind: "invited", label: "Invited", description: "You've been invited to a site or team." },
    ],
  },
  {
    heading: "Hazard & JSA",
    protected: false,
    rows: [
      { kind: "hazard_incident_linked", label: "Hazard linked to incident", description: "An incident you reported was tied to an existing hazard." },
      { kind: "jsa_review_required", label: "JSA review required", description: "A JSA you authored or approved is up for periodic review." },
    ],
  },
];

export function NotificationsPrefsCard({
  initialSilenced,
}: {
  initialSilenced: ReadonlyArray<string>;
}) {
  const [silenced, setSilenced] = useState<Set<string>>(
    new Set(initialSilenced),
  );
  const [isPending, startTransition] = useTransition();

  function onToggle(kind: string, subscribed: boolean) {
    const wantSilenced = !subscribed;
    const previous = new Set(silenced);
    const next = new Set(silenced);
    if (wantSilenced) next.add(kind);
    else next.delete(kind);
    setSilenced(next);

    startTransition(async () => {
      const res = await setNotificationSilence(kind, wantSilenced);
      if (!res.ok) {
        setSilenced(previous);
        toast.error(res.error);
      }
    });
  }

  return (
    <section
      aria-labelledby="settings-notifications-heading"
      className="space-y-5 rounded-lg border bg-card p-5"
    >
      <div>
        <h2
          id="settings-notifications-heading"
          className="text-base font-semibold"
        >
          Notifications
        </h2>
        <p className="text-xs text-muted-foreground">
          Control which alerts appear in your bell and the dashboard banner.
          Life-safety and compliance notifications are always on.
        </p>
      </div>

      <div className="space-y-6">
        {NOTIFICATION_GROUPS.map((group) => (
          <div key={group.heading} className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{group.heading}</h3>
                {group.protected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Lock className="h-3 w-3" aria-hidden /> Locked
                  </span>
                )}
              </div>
              {group.rationale && (
                <p className="text-xs text-muted-foreground">{group.rationale}</p>
              )}
            </div>
            <ul className="divide-y rounded-md border">
              {group.rows.map((row) => {
                const isSilenced = silenced.has(row.kind);
                const subscribed = !isSilenced;
                return (
                  <li
                    key={row.kind}
                    className="flex items-start justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="flex-1">
                      <Label
                        htmlFor={`notif-${row.kind}`}
                        className="text-sm font-medium"
                      >
                        {row.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {row.description}
                      </p>
                    </div>
                    <Switch
                      id={`notif-${row.kind}`}
                      checked={group.protected ? true : subscribed}
                      onCheckedChange={(checked) =>
                        onToggle(row.kind, checked === true)
                      }
                      disabled={isPending || group.protected}
                      aria-label={
                        group.protected
                          ? `${row.label} (locked on)`
                          : `Subscribe to ${row.label}`
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
