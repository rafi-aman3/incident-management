"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { SeverityDistributionRow } from "@/lib/dashboard/org/severity-distribution";

const COLORS: Record<SeverityDistributionRow["severity"], string> = {
  S1: "#dc2626",
  S2: "#d97706",
  S3: "#eab308",
  S4: "#16a34a",
};

export function SeverityDistributionChart({ data }: { data: SeverityDistributionRow[] }) {
  const total = data.reduce((s, r) => s + r.count, 0);
  if (total === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground">
        No incidents this year yet
      </div>
    );
  }
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="severity"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((row) => (
              <Cell key={row.severity} fill={COLORS[row.severity]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 6,
              border: "1px solid var(--border)",
              fontSize: 12,
            }}
            formatter={(value, name) => [`${value} incidents`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
