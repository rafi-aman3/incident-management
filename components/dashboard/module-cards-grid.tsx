import {
  AlertOctagon,
  ClipboardCheck,
  ShieldAlert,
  HardHat,
  Wrench,
  Search,
} from "lucide-react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { orgCan } from "@/lib/auth/orgCan";
import { ModuleCard } from "./module-card";
import { getIncidentsModuleCard } from "@/lib/dashboard/org/modules/incidents";
import { getInspectionsModuleCard } from "@/lib/dashboard/org/modules/inspections";
import { getHazardsModuleCard } from "@/lib/dashboard/org/modules/hazards";
import { getJsaModuleCard } from "@/lib/dashboard/org/modules/jsa";
import { getCapaModuleCard } from "@/lib/dashboard/org/modules/capa";
import { getInvestigationsModuleCard } from "@/lib/dashboard/org/modules/investigations";

// Permission-gated module grid. Site-scope cards (incident:read_site,
// inspection:read_site, hazard:read_site, jsa:read_site) use their own
// read perms; CAPA + Investigations have no dedicated read perm, so we
// gate on the existing surface-level perm the list page already uses
// (capa:complete on /capa, investigation:lead on /investigations).
//
// When siteId is non-null the aggregators scope to that one site; pass
// null for org-wide rollups. RLS handles cross-site visibility either way.
export async function ModuleCardsGrid({
  orgId,
  siteId,
}: {
  orgId: string;
  siteId: string | null;
}) {
  const supabase = await createClient();
  const [
    canIncidents,
    canInspections,
    canHazards,
    canJsa,
    canCapa,
    canInvest,
    incidents,
    inspections,
    hazards,
    jsa,
    capa,
    investigations,
  ] = await Promise.all([
    orgCan("incident:read_site"),
    orgCan("inspection:read_site"),
    orgCan("hazard:read_site"),
    orgCan("jsa:read_site"),
    orgCan("capa:complete"),
    orgCan("investigation:lead"),
    getIncidentsModuleCard(supabase, orgId, siteId),
    getInspectionsModuleCard(supabase, orgId, siteId),
    getHazardsModuleCard(supabase, orgId, siteId),
    getJsaModuleCard(supabase, orgId, siteId),
    getCapaModuleCard(supabase, orgId, siteId),
    getInvestigationsModuleCard(supabase, orgId, siteId),
  ]);

  const cards: Array<{ gate: boolean; node: ReactNode }> = [
    {
      gate: canIncidents,
      node: (
        <ModuleCard
          key="inc"
          title="Incidents"
          tagline="Capture · classify · route"
          Icon={AlertOctagon}
          data={incidents}
          href="/incidents"
        />
      ),
    },
    {
      gate: canInspections,
      node: (
        <ModuleCard
          key="ins"
          title="Inspections"
          tagline="Templates + scheduled runs"
          Icon={ClipboardCheck}
          data={inspections}
          href="/inspections"
        />
      ),
    },
    {
      gate: canHazards,
      node: (
        <ModuleCard
          key="haz"
          title="Hazards"
          tagline="Register + residual risk"
          Icon={ShieldAlert}
          data={hazards}
          href="/hazards"
        />
      ),
    },
    {
      gate: canJsa,
      node: (
        <ModuleCard
          key="jsa"
          title="JSA"
          tagline="Job safety analyses"
          Icon={HardHat}
          data={jsa}
          href="/jsa"
        />
      ),
    },
    {
      gate: canCapa,
      node: (
        <ModuleCard
          key="cap"
          title="CAPA"
          tagline="Corrective + preventive actions"
          Icon={Wrench}
          data={capa}
          href="/capa"
        />
      ),
    },
    {
      gate: canInvest,
      node: (
        <ModuleCard
          key="inv"
          title="Investigations"
          tagline="Track-A root cause"
          Icon={Search}
          data={investigations}
          href="/investigations"
        />
      ),
    },
  ];

  const visible = cards.filter((c) => c.gate);
  if (visible.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Modules</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => c.node)}
      </div>
    </section>
  );
}
