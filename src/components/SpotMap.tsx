"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { BasemapToggle } from "./BasemapToggle";
import {
  addBasemapToMap,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_FRAME_CLASS,
  DEFAULT_MAP_STYLE,
  DEFAULT_MAP_ZOOM,
  loadLeaflet,
  type LeafletNS,
  type MapStyle,
} from "@/lib/map-tiles";
import { yearFromDateKey } from "@/lib/calendar";
import { baitTypesLabel } from "@/lib/bait";
import type { BaitSpot, SpotGroup } from "@/lib/types";
import "leaflet/dist/leaflet.css";

function spotsSignature(
  spots: SpotGroup[],
  baitSpots: BaitSpot[],
  selectedKey: string | null,
): string {
  const catchPart = spots
    .map(
      (s) =>
        `${s.key}:${s.latitude}:${s.longitude}:${s.catchCount}:${s.fishCount}:${s.placeName}:${selectedKey === s.key ? 1 : 0}`,
    )
    .join("|");
  const baitPart = baitSpots
    .map((s) => `bait:${s.id}:${s.latitude}:${s.longitude}:${s.loggedAt}`)
    .join("|");
  return `${catchPart}::${baitPart}`;
}

export function SpotMap({
  spots,
  baitSpots = [],
  selectedKey,
  onSelect,
  className = DEFAULT_MAP_FRAME_CLASS,
}: {
  spots: SpotGroup[];
  baitSpots?: BaitSpot[];
  selectedKey: string | null;
  onSelect?: (key: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const spotsRef = useRef(spots);
  const baitRef = useRef(baitSpots);
  const onSelectRef = useRef(onSelect);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const basemapLayerRef = useRef<{ remove: () => void } | null>(null);
  const [basemap, setBasemap] = useState<MapStyle>(DEFAULT_MAP_STYLE);
  const basemapStyleRef = useRef<MapStyle>(basemap);
  const signature = spotsSignature(spots, baitSpots, selectedKey);

  useEffect(() => {
    spotsRef.current = spots;
    baitRef.current = baitSpots;
    onSelectRef.current = onSelect;
    basemapStyleRef.current = basemap;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = spotsRef.current;
    const currentBait = baitRef.current;
    const catchCoords = current.filter((s) => s.latitude != null && s.longitude != null);
    const baitCoords = currentBait.filter((s) => s.latitude != null && s.longitude != null);
    const pinLatLngs: [number, number][] = [
      ...catchCoords.map((s) => [s.latitude!, s.longitude!] as [number, number]),
      ...baitCoords.map((s) => [s.latitude!, s.longitude!] as [number, number]),
    ];
    let cancelled = false;

    function zoomToSpots(instance: LeafletMap, L: LeafletNS) {
      instance.invalidateSize();
      const center = pinLatLngs[0] ?? DEFAULT_MAP_CENTER;
      if (pinLatLngs.length > 1) {
        const bounds = L.latLngBounds(pinLatLngs);
        instance.fitBounds(bounds.pad(0.18), { maxZoom: 17, animate: false });
      } else if (pinLatLngs.length === 1) {
        instance.setView(center, 16, { animate: false });
      } else {
        instance.setView(center, DEFAULT_MAP_ZOOM, { animate: false });
      }
    }

    (async () => {
      const L = await loadLeaflet();
      if (cancelled || !el) return;
      LRef.current = L;

      const leafletEl = el as HTMLElement & { _leaflet_id?: number };
      if (leafletEl._leaflet_id) {
        leafletEl._leaflet_id = undefined;
        leafletEl.replaceChildren();
      }

      if (el.clientWidth === 0 || el.clientHeight === 0) {
        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            roSize.disconnect();
            resolve();
          };
          const roSize = new ResizeObserver(() => {
            if (el.clientWidth > 0 && el.clientHeight > 0) finish();
          });
          roSize.observe(el);
          requestAnimationFrame(() => {
            if (el.clientWidth > 0 && el.clientHeight > 0) finish();
          });
          window.setTimeout(finish, 300);
        });
      }
      if (cancelled || !el) return;

      const center = pinLatLngs[0] ?? DEFAULT_MAP_CENTER;

      const instance = L.map(el, {
        zoomControl: true,
        attributionControl: true,
        maxZoom: 19,
      }).setView(center, pinLatLngs.length ? 16 : DEFAULT_MAP_ZOOM);
      basemapLayerRef.current = addBasemapToMap(L, instance, basemapStyleRef.current);

      for (const spot of catchCoords) {
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
      }
      for (const spot of baitCoords) {
        const marker = L.circleMarker([spot.latitude!, spot.longitude!], {
          radius: 7,
          color: "#c45c26",
          fillColor: "#c45c26",
          fillOpacity: 0.9,
          weight: 2,
        }).addTo(instance);
        marker.bindTooltip(
          `Bait · ${baitTypesLabel(spot.baitTypes)} · ${spot.placeName || "hole"}`,
        );
      }
      zoomToSpots(instance, L);
      instance.whenReady(() => {
        if (!cancelled) zoomToSpots(instance, L);
      });
      window.setTimeout(() => {
        if (!cancelled) zoomToSpots(instance, L);
      }, 200);
      mapRef.current = instance;
    })();

    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    ro.observe(el);

    return () => {
      cancelled = true;
      ro.disconnect();
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
