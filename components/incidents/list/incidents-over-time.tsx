"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyTrendPoint } from "@/lib/queries/incidents-list";

export function IncidentsOverTime({ data }: { data: MonthlyTrendPoint[] }) {
  const max = Math.max(0, ...data.map((d) => d.count));
  const yMax = Math.max(4, Math.ceil(max * 1.2));

  return (
    <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Incidents over time
          </h2>
          <p className="text-sm text-muted-foreground">
            Monthly count — last 12 months
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden />
          Incident count
        </span>
      </div>
      <div className="mt-4 h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="incidentTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
              stroke="var(--foreground-muted)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--foreground-muted)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              domain={[0, yMax]}
              width={28}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              contentStyle={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--foreground)" }}
              formatter={(value) => [Number(value ?? 0), "Incidents"]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--destructive)"
              strokeWidth={2}
              fill="url(#incidentTrend)"
              activeDot={{ r: 4, fill: "var(--destructive)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
