"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { BasemapToggle } from "./BasemapToggle";
import {
  addBasemapToMap,
  DEFAULT_MAP_STYLE,
  loadLeaflet,
  type LeafletNS,
  type MapStyle,
} from "@/lib/map-tiles";
import "leaflet/dist/leaflet.css";

const PIN_BOX = 36;
const PIN_DOT = 22;
const PIN_HTML = `<div style="width:${PIN_BOX}px;height:${PIN_BOX}px;display:flex;align-items:center;justify-content:center"><div style="width:${PIN_DOT}px;height:${PIN_DOT}px;border-radius:50%;background:#c45c26;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.55)"></div></div>`;

function pinIcon(leaflet: LeafletNS) {
  return leaflet.divIcon({
    className: "catch-map-pin",
    html: PIN_HTML,
    iconSize: [PIN_BOX, PIN_BOX],
    iconAnchor: [PIN_BOX / 2, PIN_BOX / 2],
  });
}

export function MapPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const coordsRef = useRef({ latitude, longitude });
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const basemapRef = useRef<{ remove: () => void } | null>(null);
  const [basemap, setBasemap] = useState<MapStyle>(DEFAULT_MAP_STYLE);
  const basemapRefStyle = useRef<MapStyle>(basemap);
  const hasPin = latitude != null && longitude != null;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    coordsRef.current = { latitude, longitude };
  }, [latitude, longitude]);

  useEffect(() => {
    basemapRefStyle.current = basemap;
  }, [basemap]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;

    (async () => {
      const leaflet = await loadLeaflet();
      if (cancelled || !el) return;
      LRef.current = leaflet;
      const current = coordsRef.current;
      const start: [number, number] =
        current.latitude != null && current.longitude != null
          ? [current.latitude, current.longitude]
          : [28.5, -81.3];
      const instance = leaflet
        .map(el, { zoomControl: true, maxZoom: 19, tapTolerance: 25 })
        .setView(start, current.latitude != null && current.longitude != null ? 16 : 5);
      basemapRef.current = addBasemapToMap(leaflet, instance, basemapRefStyle.current);
      mapRef.current = instance;

      const icon = pinIcon(leaflet);

      const bindMarker = (next: Marker) => {
        markerRef.current = next;
        next.on("dragend", () => {
          const ll = next.getLatLng();
          onChangeRef.current(ll.lat, ll.lng);
        });
      };

      if (current.latitude != null && current.longitude != null) {
        bindMarker(
          leaflet.marker(start, { icon, draggable: true, autoPan: true }).addTo(instance),
        );
      }

      instance.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const L = LRef.current;
        const map = mapRef.current;
        if (!L || !map) return;
        if (!markerRef.current) {
          bindMarker(
            L.marker(e.latlng, { icon: pinIcon(L), draggable: true, autoPan: true }).addTo(instance),
          );
        } else {
          markerRef.current.setLatLng(e.latlng);
        }
        onChangeRef.current(e.latlng.lat, e.latlng.lng);
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      basemapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    basemapRef.current = addBasemapToMap(L, map, basemap, basemapRef.current);
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    if (latitude == null || longitude == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const next = L.latLng(latitude, longitude);
    const prev = markerRef.current?.getLatLng();
    const jumped =
      !prev || Math.abs(prev.lat - latitude) > 0.002 || Math.abs(prev.lng - longitude) > 0.002;
    if (markerRef.current) {
      markerRef.current.setLatLng(next);
    } else {
      const marker = L.marker(next, { icon: pinIcon(L), draggable: true, autoPan: true }).addTo(map);
      markerRef.current = marker;
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        onChangeRef.current(ll.lat, ll.lng);
      });
    }
    if (jumped) map.setView([latitude, longitude], Math.max(map.getZoom(), 16));
  }, [latitude, longitude]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <div ref={ref} className="h-64 w-full overflow-hidden rounded-2xl border border-line" />
        <BasemapToggle value={basemap} onChange={setBasemap} />
      </div>
      <p className="on-wash-chip text-xs">
        {hasPin
          ? "Satellite by default — drag the pin or tap a new spot. It stays editable."
          : "No pin yet — tap the satellite map to drop one."}
      </p>
    </div>
  );
}
