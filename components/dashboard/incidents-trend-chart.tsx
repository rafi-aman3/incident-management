"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendRow } from "@/lib/dashboard/org/incidents-trend";

const SEVERITY_COLORS: Record<"S1" | "S2" | "S3" | "S4", string> = {
  S1: "#dc2626",
  S2: "#d97706",
  S3: "#eab308",
  S4: "#16a34a",
};

export function IncidentsTrendChart({ data }: { data: TrendRow[] }) {
  const isEmpty = data.every((r) => r.S1 + r.S2 + r.S3 + r.S4 === 0);
  if (isEmpty) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground">
        No incidents in the last 12 months
      </div>
    );
  }
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 11, fill: "var(--foreground-muted)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--foreground-muted)" }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 6,
              border: "1px solid var(--border)",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          <Area
            type="monotone"
            dataKey="S4"
            stackId="1"
            stroke={SEVERITY_COLORS.S4}
            fill={SEVERITY_COLORS.S4}
            fillOpacity={0.4}
          />
          <Area
            type="monotone"
            dataKey="S3"
            stackId="1"
            stroke={SEVERITY_COLORS.S3}
            fill={SEVERITY_COLORS.S3}
            fillOpacity={0.4}
          />
          <Area
            type="monotone"
            dataKey="S2"
            stackId="1"
            stroke={SEVERITY_COLORS.S2}
            fill={SEVERITY_COLORS.S2}
            fillOpacity={0.4}
          />
          <Area
            type="monotone"
            dataKey="S1"
            stackId="1"
            stroke={SEVERITY_COLORS.S1}
            fill={SEVERITY_COLORS.S1}
            fillOpacity={0.4}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
