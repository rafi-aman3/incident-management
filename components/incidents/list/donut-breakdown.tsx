"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { Database } from "@/lib/supabase/types";

type Severity = Database["public"]["Enums"]["severity"];

const SEVERITY_LABEL: Record<Severity, string> = {
  S1: "S1 — Catastrophic",
  S2: "S2 — Major",
  S3: "S3 — Moderate",
  S4: "S4 — Minor",
  S5: "S5 — Insignificant",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  S1: "var(--color-sev-1)",
  S2: "var(--color-sev-2)",
  S3: "var(--color-sev-3)",
  S4: "var(--color-sev-4)",
  S5: "var(--color-sev-5)",
};

export function DonutBreakdown({
  rows,
}: {
  rows: Array<{ key: Severity; count: number }>;
}) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const visible = rows.filter((r) => r.count > 0);

  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        By Severity
      </h3>
      {total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No incidents yet.</p>
      ) : (
        <>
          <div className="relative mt-3 flex h-[140px] items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visible}
                  dataKey="count"
                  nameKey="key"
                  innerRadius={42}
                  outerRadius={64}
                  startAngle={90}
                  endAngle={-270}
                  stroke="var(--background)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {visible.map((row) => (
                    <Cell key={row.key} fill={SEVERITY_COLOR[row.key]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums leading-none">
                {total}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Total
              </span>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs">
            {visible.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: SEVERITY_COLOR[row.key] }}
                    aria-hidden
                  />
                  <span className="text-muted-foreground">
                    {SEVERITY_LABEL[row.key]}
                  </span>
                </span>
                <span className="tabular-nums">{row.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
