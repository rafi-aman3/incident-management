import Link from "next/link";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSitesMapPayload } from "@/lib/dashboard/org/sites-map";
import { SitesMapClient } from "./sites-map-client";

export async function SitesMapCard({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const payload = await getSitesMapPayload(supabase, orgId);

  if (payload.markers.length === 0) {
    return (
      <section className="rounded-md border bg-card p-6">
        <h2 className="text-sm font-semibold">Sites map</h2>
        <div className="mt-4 flex flex-col items-center gap-3 rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <MapPin className="h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            No sites have coordinates yet. Add latitude/longitude in site setup
            to see your sites on the map.
          </p>
          <Link
            href="/admin/site-setup"
            className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Open site setup →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Sites map</h2>
        {payload.hiddenForMissingCoords > 0 && (
          <p className="text-xs text-muted-foreground">
            {payload.hiddenForMissingCoords} site
            {payload.hiddenForMissingCoords === 1 ? "" : "s"} hidden — missing
            coordinates
          </p>
        )}
      </div>
      <SitesMapClient markers={payload.markers} />
    </section>
  );
}
