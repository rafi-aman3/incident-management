"use client";

import dynamic from "next/dynamic";
import type { SiteMapMarker } from "@/lib/dashboard/org/sites-map";

const SitesMap = dynamic(
  () => import("./sites-map").then((m) => m.SitesMap),
  {
    ssr: false,
    loading: () => (
      <div className="relative isolate h-[360px] w-full overflow-hidden rounded-md border bg-muted/30" />
    ),
  },
);

export function SitesMapClient({ markers }: { markers: SiteMapMarker[] }) {
  return <SitesMap markers={markers} />;
}
