"use client";

import L from "leaflet";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import type { LeafletKeyboardEvent } from "leaflet";
import type { SiteMapMarker } from "@/lib/dashboard/org/sites-map";

// Fix Leaflet's default icon URLs (Next bundling clobbers them). We use
// CircleMarker so default icons aren't strictly needed — but this patch is
// cheap insurance if anyone later switches to <Marker>.
// @ts-expect-error — _getIconUrl is internal but conventional to patch.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

function colorFor(marker: SiteMapMarker): string {
  if (marker.stopWorkActive) return "#dc2626"; // red-600
  if (marker.criticalOpen > 0) return "#d97706"; // amber-600
  return "#16a34a"; // success green (per CLAUDE.md hard rule)
}

export function SitesMap({ markers }: { markers: SiteMapMarker[] }) {
  const router = useRouter();
  const bounds: L.LatLngBoundsExpression | undefined =
    markers.length >= 2
      ? markers.map((m) => [m.lat, m.lng] as [number, number])
      : undefined;
  const center: [number, number] =
    markers.length === 1 ? [markers[0].lat, markers[0].lng] : [20, 0];
  const zoom = markers.length === 1 ? 10 : 2;

  return (
    <MapContainer
      bounds={bounds}
      center={center}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-[360px] w-full rounded-md border"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lng]}
          radius={9}
          pathOptions={{
            color: colorFor(m),
            fillColor: colorFor(m),
            fillOpacity: 0.7,
            weight: 2,
          }}
          eventHandlers={{
            click: () => router.push(`/sites/${m.id}`),
            keydown: (e: LeafletKeyboardEvent) => {
              if (e.originalEvent.key === "Enter" || e.originalEvent.key === " ") {
                router.push(`/sites/${m.id}`);
              }
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent={false}>
            <div className="text-xs">
              <div className="font-semibold">{m.name}</div>
              {m.stopWorkActive && (
                <div className="text-red-600">Stop-work active</div>
              )}
              {!m.stopWorkActive && m.criticalOpen > 0 && (
                <div className="text-amber-700">
                  {m.criticalOpen} critical open
                </div>
              )}
              {!m.stopWorkActive && m.criticalOpen === 0 && (
                <div className="text-green-700">Clean</div>
              )}
              <div className="text-muted-foreground">Click to open →</div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
