import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrendPill, type TrendInput } from "./trend-pill";

export type KpiAccent =
  | "destructive"
  | "warning"
  | "amber"
  | "brand"
  | "success"
  | "info";

const ACCENT: Record<
  KpiAccent,
  { border: string; iconBg: string; iconFg: string; valueFg: string }
> = {
  destructive: {
    border: "border-l-destructive",
    iconBg: "bg-destructive/10",
    iconFg: "text-destructive",
    valueFg: "text-destructive",
  },
  warning: {
    border: "border-l-warning",
    iconBg: "bg-warning/10",
    iconFg: "text-warning",
    valueFg: "text-foreground",
  },
  amber: {
    border: "border-l-sev-3",
    iconBg: "bg-sev-3/10",
    iconFg: "text-sev-3",
    valueFg: "text-foreground",
  },
  brand: {
    border: "border-l-primary",
    iconBg: "bg-primary/10",
    iconFg: "text-primary",
    valueFg: "text-foreground",
  },
  success: {
    border: "border-l-success",
    iconBg: "bg-success/10",
    iconFg: "text-success",
    valueFg: "text-foreground",
  },
  info: {
    border: "border-l-info",
    iconBg: "bg-info/10",
    iconFg: "text-info",
    valueFg: "text-foreground",
  },
};

export type KpiCardProps = {
  label: string;
  value: string;
  sub?: string;
  formula?: string;
  trend?: TrendInput;
  icon: LucideIcon;
  accent: KpiAccent;
};

export function KpiCard({
  label,
  value,
  sub,
  formula,
  trend,
  icon: Icon,
  accent,
}: KpiCardProps) {
  const a = ACCENT[accent];
  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border border-l-4 bg-card p-4 ring-1 ring-foreground/5",
        a.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            a.iconBg,
          )}
          aria-hidden
        >
          <Icon className={cn("h-4 w-4", a.iconFg)} />
        </span>
      </div>
      <div
        className={cn(
          "font-semibold tabular-nums leading-none text-3xl xl:text-4xl",
          a.valueFg,
        )}
      >
        {value}
      </div>
      {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
      {formula && (
        <div className="font-mono text-[11px] text-muted-foreground">{formula}</div>
      )}
      {trend && (
        <div className="absolute bottom-3 right-3">
          <TrendPill trend={trend} />
        </div>
      )}
    </div>
  );
}
