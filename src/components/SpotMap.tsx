"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { BasemapToggle } from "./BasemapToggle";
import {
  addBasemapToMap,
  DEFAULT_MAP_STYLE,
  loadLeaflet,
  type LeafletNS,
  type MapStyle,
} from "@/lib/map-tiles";
import { yearFromDateKey } from "@/lib/calendar";
import type { SpotGroup } from "@/lib/types";
import "leaflet/dist/leaflet.css";

function spotsSignature(spots: SpotGroup[], selectedKey: string | null): string {
  return spots
    .map(
      (s) =>
        `${s.key}:${s.latitude}:${s.longitude}:${s.catchCount}:${s.fishCount}:${s.placeName}:${selectedKey === s.key ? 1 : 0}`,
    )
    .join("|");
}

export function SpotMap({
  spots,
  selectedKey,
  onSelect,
  className = "h-64 w-full overflow-hidden rounded-2xl border border-line",
}: {
  spots: SpotGroup[];
  selectedKey: string | null;
  onSelect?: (key: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const spotsRef = useRef(spots);
  const onSelectRef = useRef(onSelect);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const basemapLayerRef = useRef<{ remove: () => void } | null>(null);
  const [basemap, setBasemap] = useState<MapStyle>(DEFAULT_MAP_STYLE);
  const basemapStyleRef = useRef<MapStyle>(basemap);
  const signature = spotsSignature(spots, selectedKey);

  useEffect(() => {
    spotsRef.current = spots;
    onSelectRef.current = onSelect;
    basemapStyleRef.current = basemap;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = spotsRef.current;
    const withCoords = current.filter((s) => s.latitude != null && s.longitude != null);
    let cancelled = false;

    (async () => {
      const L = await loadLeaflet();
      if (cancelled || !el) return;
      LRef.current = L;

      const center = withCoords[0]
        ? ([withCoords[0].latitude!, withCoords[0].longitude!] as [number, number])
        : ([39.5, -98] as [number, number]);

      const instance = L.map(el, {
        zoomControl: true,
        attributionControl: true,
        maxZoom: 19,
      }).setView(center, withCoords.length ? 14 : 4);
      basemapLayerRef.current = addBasemapToMap(L, instance, basemapStyleRef.current);

      const bounds = L.latLngBounds([]);
      for (const spot of withCoords) {
        const marker = L.circleMarker([spot.latitude!, spot.longitude!], {
          radius: 8 + Math.min(8, spot.catchCount),
          color: spot.key === selectedKey ? "#c45c26" : "#0a4e6a",
          fillColor: spot.key === selectedKey ? "#c45c26" : "#0a4e6a",
          fillOpacity: 0.85,
          weight: 2,
        }).addTo(instance);
        const years = [
          ...new Set(spot.catches.map((c) => yearFromDateKey(c.caughtAt))),
        ].sort((a, b) => b - a);
        const yearBit = years.length > 1 ? ` · ${years.join(" · ")}` : "";
        marker.bindTooltip(
          `${spot.placeName} · ${spot.fishCount} fish · ${spot.catchCount} ${
            spot.catchCount === 1 ? "trip" : "trips"
          }${yearBit}`,
        );
        marker.on("click", () => onSelectRef.current?.(spot.key));
        bounds.extend([spot.latitude!, spot.longitude!]);
      }
      if (withCoords.length > 1) instance.fitBounds(bounds.pad(0.25));
      else if (withCoords.length === 1) instance.setView(center, 15);
      mapRef.current = instance;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      basemapLayerRef.current = null;
    };
  }, [signature, selectedKey]);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    basemapLayerRef.current = addBasemapToMap(L, map, basemap, basemapLayerRef.current);
  }, [basemap]);

  return (
    <div className="relative">
      <div ref={ref} className={className} />
      <BasemapToggle value={basemap} onChange={setBasemap} />
    </div>
  );
}
