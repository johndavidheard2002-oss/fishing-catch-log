"use client";

import { useEffect, useRef } from "react";
import type { SpotGroup } from "@/lib/types";
import "leaflet/dist/leaflet.css";

export function SpotMap({
  spots,
  selectedKey,
  onSelect,
}: {
  spots: SpotGroup[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const withCoords = spots.filter((s) => s.latitude != null && s.longitude != null);
    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el) return;

      const center = withCoords[0]
        ? ([withCoords[0].latitude!, withCoords[0].longitude!] as [number, number])
        : ([39.5, -98] as [number, number]);

      const instance = L.map(el, { zoomControl: true, attributionControl: true }).setView(
        center,
        withCoords.length ? 5 : 4,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(instance);

      const bounds = L.latLngBounds([]);
      for (const spot of withCoords) {
        const marker = L.circleMarker([spot.latitude!, spot.longitude!], {
          radius: 8 + Math.min(8, spot.catchCount),
          color: spot.key === selectedKey ? "#c45c26" : "#134e4c",
          fillColor: spot.key === selectedKey ? "#c45c26" : "#134e4c",
          fillOpacity: 0.85,
          weight: 2,
        }).addTo(instance);
        marker.bindTooltip(`${spot.placeName} · ${spot.fishCount} fish · ${spot.catchCount}`);
        marker.on("click", () => onSelect(spot.key));
        bounds.extend([spot.latitude!, spot.longitude!]);
      }
      if (withCoords.length > 1) instance.fitBounds(bounds.pad(0.25));
      map = instance;
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [spots, selectedKey, onSelect]);

  return <div ref={ref} className="h-64 w-full overflow-hidden rounded-2xl border border-line" />;
}
