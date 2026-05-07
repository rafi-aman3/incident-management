import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrendDirection = "up" | "down" | "flat";
export type TrendTone = "destructive" | "success" | "muted";

export type TrendInput = {
  direction: TrendDirection;
  label: string;
  tone: TrendTone;
};

const TONE: Record<TrendTone, string> = {
  destructive: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
  muted: "bg-muted text-muted-foreground",
};

export function TrendPill({ trend }: { trend: TrendInput }) {
  const Icon =
    trend.direction === "up"
      ? ArrowUpRight
      : trend.direction === "down"
      ? ArrowDownRight
      : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums",
        TONE[trend.tone],
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {trend.label}
    </span>
  );
}

// Helper to compute the trend for "This Month vs last full month".
// More incidents = bad → destructive. Fewer = good → success. Same = muted.
export function computeMonthOverMonthTrend(
  thisMonth: number,
  prevMonth: number,
): TrendInput {
  const delta = thisMonth - prevMonth;
  if (delta === 0) {
    return { direction: "flat", tone: "muted", label: "— same vs last mo" };
  }
  const direction: TrendDirection = delta > 0 ? "up" : "down";
  const tone: TrendTone = delta > 0 ? "destructive" : "success";
  const arrow = delta > 0 ? "↗" : "↘";
  return {
    direction,
    tone,
    label: `${arrow} ${Math.abs(delta)} vs last mo`,
  };
}
