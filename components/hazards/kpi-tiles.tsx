import Link from "next/link";
import { TriangleAlert, AlertOctagon, Calendar, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type HazardKpis = {
  identifiedCount: number;
  highRiskCount: number;
  overdueReviewCount: number;
  ppeOnlyCount: number;
};

const TILES = [
  {
    key: "identified",
    label: "Hazards identified",
    icon: TriangleAlert,
    href: "/hazards",
    tone: "default" as const,
    description: "Open hazards across all sites you can access.",
  },
  {
    key: "high_risk",
    label: "High-risk (S1–S2)",
    icon: AlertOctagon,
    href: "/hazards?risk=high",
    tone: "destructive" as const,
    description: "Hazards with residual risk Critical or Major.",
  },
  {
    key: "overdue",
    label: "Overdue reviews",
    icon: Calendar,
    href: "/hazards?reviews=overdue",
    tone: "default" as const,
    description: "Assessment or control review date is in the past.",
  },
  {
    key: "ppe_only",
    label: "PPE-only controls",
    icon: ShieldOff,
    href: "/hazards?controls=ppe_only",
    tone: "warning" as const,
    description: "Auditor warning: relying solely on PPE violates the hierarchy of controls.",
  },
];

export function HazardKpiTiles({ kpis }: { kpis: HazardKpis }) {
  const values: Record<string, number> = {
    identified: kpis.identifiedCount,
    high_risk: kpis.highRiskCount,
    overdue: kpis.overdueReviewCount,
    ppe_only: kpis.ppeOnlyCount,
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TILES.map((t) => {
        const Icon = t.icon;
        const value = values[t.key] ?? 0;
        const accent =
          t.tone === "destructive"
            ? "text-destructive"
            : t.tone === "warning"
            ? "text-warning"
            : "text-foreground";
        const ring =
          t.tone === "warning" && value > 0
            ? "ring-1 ring-warning/40 bg-warning/5"
            : "";
        return (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "block rounded-lg border bg-card p-4 transition hover:border-foreground/20",
              ring,
            )}
          >
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>{t.label}</span>
              <Icon className={cn("h-4 w-4", accent)} aria-hidden />
            </div>
            <div className={cn("mt-2 text-3xl font-semibold tabular-nums", accent)}>
              {value}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
