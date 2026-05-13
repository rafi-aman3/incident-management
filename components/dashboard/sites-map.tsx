"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SiteMapMarker } from "@/lib/dashboard/org/sites-map";

// Fix Leaflet's default icon URLs (Next bundling clobbers them). We use
// L.circleMarker so default icons aren't strictly needed — but this patch is
// cheap insurance if anyone later switches to L.marker.
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

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

function tooltipHtml(m: SiteMapMarker): string {
  const status = m.stopWorkActive
    ? '<div style="color:#dc2626">Stop-work active</div>'
    : m.criticalOpen > 0
      ? `<div style="color:#b45309">${m.criticalOpen} critical open</div>`
      : '<div style="color:#15803d">Clean</div>';
  return `<div style="font-size:12px"><div style="font-weight:600">${escapeHtml(m.name)}</div>${status}<div style="color:#6b7280">Click to open →</div></div>`;
}

export function SitesMap({ markers }: { markers: SiteMapMarker[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Defensive: if a previous mount left Leaflet state on the DIV (React 19
    // Strict Mode dev double-effect, HMR, or Next 16 Router Cache restoring
    // /dashboard on back-nav), clear it so L.map() doesn't trip the
    // "Map container is being reused by another instance" error.
    if ((container as unknown as { _leaflet_id?: number })._leaflet_id) {
      delete (container as unknown as { _leaflet_id?: number })._leaflet_id;
      container.innerHTML = "";
    }

    const map = L.map(container, {
      center:
        markers.length === 1 ? [markers[0].lat, markers[0].lng] : [20, 0],
      zoom: markers.length === 1 ? 10 : 2,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    if (markers.length >= 2) {
      map.fitBounds(
        markers.map((m) => [m.lat, m.lng] as [number, number]),
        { padding: [20, 20] },
      );
    }

    markers.forEach((m) => {
      const circle = L.circleMarker([m.lat, m.lng], {
        radius: 9,
        color: colorFor(m),
        fillColor: colorFor(m),
        fillOpacity: 0.7,
        weight: 2,
      }).addTo(map);
      circle.bindTooltip(tooltipHtml(m), {
        direction: "top",
        offset: [0, -8],
        opacity: 1,
      });
      circle.on("click", () => router.push(`/sites/${m.id}`));
      circle.on("keydown", (e: L.LeafletKeyboardEvent) => {
        if (
          e.originalEvent.key === "Enter" ||
          e.originalEvent.key === " "
        ) {
          router.push(`/sites/${m.id}`);
        }
      });
    });

    return () => {
      map.remove();
    };
  }, [markers, router]);

  return (
    <div
      ref={containerRef}
      className="relative isolate h-[360px] w-full overflow-hidden rounded-md border [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-pane]:z-0 [&_.leaflet-top]:z-10 [&_.leaflet-bottom]:z-10"
      style={{ zIndex: 0 }}
    />
  );
}
