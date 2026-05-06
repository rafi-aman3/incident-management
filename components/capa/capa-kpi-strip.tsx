import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CapaKpiCounts = {
  active: number;
  pendingVerification: number;
  overdue: number;
  closed: number;
};

const TILES: Array<{
  key: keyof CapaKpiCounts;
  label: string;
  href: string;
  icon: typeof CheckCircle2;
  tone: string;
}> = [
  {
    key: "active",
    label: "Active",
    href: "/capa?tab=active",
    icon: ListChecks,
    tone: "text-foreground",
  },
  {
    key: "pendingVerification",
    label: "Pending verification",
    href: "/capa?tab=pending_verification",
    icon: Clock,
    tone: "text-warning",
  },
  {
    key: "overdue",
    label: "Overdue",
    href: "/capa?tab=overdue",
    icon: AlertTriangle,
    tone: "text-destructive",
  },
  {
    key: "closed",
    label: "Closed",
    href: "/capa?tab=closed",
    icon: CheckCircle2,
    tone: "text-success",
  },
];

export function CapaKpiStrip({ counts }: { counts: CapaKpiCounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TILES.map((t) => {
        const Icon = t.icon;
        const value = counts[t.key];
        return (
          <Link
            key={t.key}
            href={t.href}
            className="group flex items-center gap-3 rounded-lg border bg-card p-3 hover:border-primary"
          >
            <div className={cn("rounded-md bg-muted p-2", t.tone)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="text-xl font-semibold tabular-nums">{value}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
