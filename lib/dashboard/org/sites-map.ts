// lib/dashboard/org/sites-map.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type SiteMapMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Open S1/S2 incident count (any incident with severity in (S1,S2) and status != closed). */
  criticalOpen: number;
  /** True if any incident at the site has stop_work=true and stop_work_acknowledged_at IS NULL. */
  stopWorkActive: boolean;
};

export type SitesMapPayload = {
  markers: SiteMapMarker[];
  /** Number of sites in the org with NULL lat or NULL lng — render a footnote when > 0. */
  hiddenForMissingCoords: number;
};

export async function getSitesMapPayload(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<SitesMapPayload> {
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, latitude, longitude")
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  const rows = sites ?? [];
  const withCoords = rows.filter(
    (s): s is typeof s & { latitude: number; longitude: number } =>
      s.latitude !== null && s.longitude !== null,
  );
  const hiddenForMissingCoords = rows.length - withCoords.length;

  if (withCoords.length === 0) {
    return { markers: [], hiddenForMissingCoords };
  }

  const ids = withCoords.map((s) => s.id);

  // Rollups — one query each, both cheap because they hit indexed columns.
  const [s1s2Res, stopRes] = await Promise.all([
    supabase
      .from("incidents")
      .select("site_id")
      .in("site_id", ids)
      .in("severity", ["S1", "S2"])
      .neq("status", "closed")
      .eq("is_sandbox", false)
      .is("deleted_at", null),
    supabase
      .from("incidents")
      .select("site_id")
      .in("site_id", ids)
      .eq("stop_work", true)
      .is("stop_work_acknowledged_at", null)
      .eq("is_sandbox", false)
      .is("deleted_at", null),
  ]);

  const criticalBySite = new Map<string, number>();
  (s1s2Res.data ?? []).forEach((r) => {
    criticalBySite.set(r.site_id, (criticalBySite.get(r.site_id) ?? 0) + 1);
  });
  const stopWorkSites = new Set((stopRes.data ?? []).map((r) => r.site_id));

  const markers: SiteMapMarker[] = withCoords.map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.latitude,
    lng: s.longitude,
    criticalOpen: criticalBySite.get(s.id) ?? 0,
    stopWorkActive: stopWorkSites.has(s.id),
  }));

  return { markers, hiddenForMissingCoords };
}
