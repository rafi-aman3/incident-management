"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ClipboardCheck,
  AlertTriangle,
  Wrench,
  HardHat,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { ChooseSiteSheet, type ChooseSiteOption } from "./choose-site-sheet";

export type QuickActionsPermissions = {
  reportIncident: boolean;
  startInspection: boolean;
  addHazard: boolean;
  createCapa: boolean;
  createJsa: boolean;
  createBulletin: boolean;
};

type ActionKey =
  | "report"
  | "inspection"
  | "hazard"
  | "capa"
  | "jsa"
  | "bulletin";

const DEST: Record<ActionKey, { path: string; label: string; needsSite: boolean }> = {
  report: { path: "/incidents/new/1", label: "incident", needsSite: true },
  inspection: { path: "/inspections", label: "inspection", needsSite: true },
  hazard: { path: "/hazards/new", label: "hazard", needsSite: true },
  capa: { path: "/capa?action=create", label: "CAPA", needsSite: true },
  jsa: { path: "/jsa/new", label: "JSA", needsSite: true },
  bulletin: { path: "/bulletins/new", label: "bulletin", needsSite: false },
};

export function QuickActionsRow({
  perms,
  sites,
  currentSiteId,
}: {
  perms: QuickActionsPermissions;
  sites: ChooseSiteOption[];
  currentSiteId: string | null;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);

  function trigger(key: ActionKey) {
    const dest = DEST[key];
    if (!dest.needsSite) {
      router.push(dest.path);
      return;
    }
    if (currentSiteId) {
      router.push(dest.path);
      return;
    }
    setPendingAction(key);
  }

  const buttons: Array<{
    key: ActionKey;
    gate: boolean;
    label: string;
    Icon: LucideIcon;
    primary?: boolean;
  }> = [
    { key: "report", gate: perms.reportIncident, label: "Report incident", Icon: Plus, primary: true },
    { key: "inspection", gate: perms.startInspection, label: "Start inspection", Icon: ClipboardCheck },
    { key: "hazard", gate: perms.addHazard, label: "Add hazard", Icon: AlertTriangle },
    { key: "capa", gate: perms.createCapa, label: "New CAPA", Icon: Wrench },
    { key: "jsa", gate: perms.createJsa, label: "New JSA", Icon: HardHat },
    { key: "bulletin", gate: perms.createBulletin, label: "New bulletin", Icon: Megaphone },
  ];

  const visible = buttons.filter((b) => b.gate);
  if (visible.length === 0) return null;

  const pendingDest = pendingAction ? DEST[pendingAction] : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {visible.map(({ key, label, Icon, primary }) => (
          <button
            key={key}
            type="button"
            onClick={() => trigger(key)}
            className={
              primary
                ? "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                : "inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <ChooseSiteSheet
        open={pendingAction !== null}
        onOpenChange={(v) => !v && setPendingAction(null)}
        sites={sites}
        destination={pendingDest?.path ?? ""}
        destinationLabel={pendingDest?.label ?? ""}
      />
    </>
  );
}
