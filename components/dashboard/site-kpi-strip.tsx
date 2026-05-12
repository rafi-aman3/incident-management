import { createClient } from "@/lib/supabase/server";
import { trir, dart, formatKpi, isDartCase } from "@/lib/format/kpi";
import { InfoTooltip } from "@/components/info-tooltip";
import type { TooltipKey } from "@/lib/constants/tooltips";

export async function SiteKpiStrip({ siteId }: { siteId: string }) {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  const [openRes, s1s2Res, recordableRes, hoursRes] = await Promise.all([
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .eq("is_sandbox", false)
      .is("deleted_at", null)
      .neq("status", "closed"),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .eq("is_sandbox", false)
      .is("deleted_at", null)
      .in("severity", ["S1", "S2"])
      .neq("status", "closed"),
    supabase
      .from("incidents")
      .select("id, injured_persons(days_away, days_restricted, fatality)")
      .eq("site_id", siteId)
      .eq("osha_recordable", true)
      .eq("is_sandbox", false)
      .is("deleted_at", null)
      .gte("occurred_at", yearStart)
      .lt("occurred_at", yearEnd),
    supabase
      .from("site_annual_hours")
      .select("hours_worked")
      .eq("site_id", siteId)
      .eq("year", year)
      .maybeSingle(),
  ]);

  const openCount = openRes.count ?? 0;
  const s1s2Count = s1s2Res.count ?? 0;
  const incs = recordableRes.data ?? [];
  const recordableCases = incs.length;
  const dartCases = incs.filter((i) =>
    (i.injured_persons ?? []).some((p) =>
      isDartCase({ days_away: p.days_away, days_restricted: p.days_restricted }),
    ),
  ).length;
  const hoursWorked = hoursRes.data?.hours_worked ?? null;

  const cards: Array<{
    label: string;
    value: string;
    tip: TooltipKey | null;
    hint: string;
    emphasis?: boolean;
  }> = [
    {
      label: "Open incidents",
      value: String(openCount),
      tip: null,
      hint: "Not yet closed",
      emphasis: true,
    },
    {
      label: "S1 / S2 open",
      value: String(s1s2Count),
      tip: "severity_codes",
      hint: "Track A — full investigation",
    },
    {
      label: `TRIR (${year})`,
      value: formatKpi(trir(recordableCases, hoursWorked)),
      tip: "trir_dart_formula",
      hint: hoursWorked
        ? `${recordableCases} recordable / ${(hoursWorked / 1000).toFixed(0)}k hr`
        : "Set annual hours on the 300A",
    },
    {
      label: `DART (${year})`,
      value: formatKpi(dart(dartCases, hoursWorked)),
      tip: "trir_dart_formula",
      hint: hoursWorked
        ? `${dartCases} DART case${dartCases === 1 ? "" : "s"}`
        : "Set annual hours on the 300A",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={
            c.emphasis
              ? "rounded-md border border-primary/30 bg-primary/5 p-4"
              : "rounded-md border bg-card p-4"
          }
        >
          <div className="flex items-center text-xs uppercase tracking-wide text-muted-foreground">
            {c.label}
            {c.tip && <InfoTooltip tip={c.tip} />}
          </div>
          <div
            className={
              c.emphasis
                ? "mt-2 text-2xl font-semibold tabular-nums text-primary"
                : "mt-2 text-2xl font-semibold tabular-nums"
            }
          >
            {c.value}
          </div>
          <div className="text-xs text-muted-foreground">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}
