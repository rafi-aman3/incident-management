import { createClient } from "@/lib/supabase/server";
import { getIncidentsTrend } from "@/lib/dashboard/org/incidents-trend";
import { getSeverityDistributionYtd } from "@/lib/dashboard/org/severity-distribution";
import { IncidentsTrendChart } from "./incidents-trend-chart";
import { SeverityDistributionChart } from "./severity-distribution-chart";

export async function TrendsSection({
  orgId,
  siteId,
}: {
  orgId: string;
  siteId: string | null;
}) {
  const supabase = await createClient();
  const [trend, sev] = await Promise.all([
    getIncidentsTrend(supabase, orgId, siteId),
    getSeverityDistributionYtd(supabase, orgId, siteId),
  ]);

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <div className="relative overflow-hidden rounded-md border bg-card p-4 transition hover:shadow-sm">
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/70 via-accent-cyan/60 to-transparent"
          aria-hidden
        />
        <h3 className="text-sm font-semibold">Incidents — last 12 months</h3>
        <p className="text-xs text-muted-foreground">Stacked by severity</p>
        <div className="mt-3">
          <IncidentsTrendChart data={trend} />
        </div>
      </div>
      <div className="relative overflow-hidden rounded-md border bg-card p-4 transition hover:shadow-sm">
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/60 to-primary/70"
          aria-hidden
        />
        <h3 className="text-sm font-semibold">Severity distribution (YTD)</h3>
        <p className="text-xs text-muted-foreground">
          {new Date().getFullYear()} incidents by severity
        </p>
        <div className="mt-3">
          <SeverityDistributionChart data={sev} />
        </div>
      </div>
    </section>
  );
}
