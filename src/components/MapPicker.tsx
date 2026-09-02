"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const PIN_HTML =
  '<div style="width:18px;height:18px;border-radius:50%;background:#c45c26;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>';

type LeafletNs = typeof import("leaflet");
type PinMarker = {
  setLatLng: (ll: { lat: number; lng: number }) => void;
  getLatLng: () => { lat: number; lng: number };
  on: (ev: string, fn: () => void) => void;
  remove: () => void;
};

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
  const mapRef = useRef<{
    setView: (ll: [number, number], zoom?: number) => void;
    getZoom: () => number;
    remove: () => void;
    on: (ev: string, fn: (e: { latlng: { lat: number; lng: number } }) => void) => void;
  } | null>(null);
  const markerRef = useRef<PinMarker | null>(null);
  const LRef = useRef<LeafletNs["default"] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { placeName: string; latitude: number; longitude: number }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const hasPin = latitude != null && longitude != null;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    coordsRef.current = { latitude, longitude };
  }, [latitude, longitude]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;

    (async () => {
      const leaflet = (await import("leaflet")).default;
      if (cancelled || !el) return;
      LRef.current = leaflet;
      const current = coordsRef.current;
      const start: [number, number] =
        current.latitude != null && current.longitude != null
          ? [current.latitude, current.longitude]
          : [28.5, -81.3];
      const instance = leaflet.map(el, { zoomControl: true }).setView(
        start,
        current.latitude != null && current.longitude != null ? 13 : 5,
      );
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(instance);
      mapRef.current = instance;

      const pinIcon = leaflet.divIcon({
        className: "catch-map-pin",
        html: PIN_HTML,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const bindMarker = (next: PinMarker) => {
        markerRef.current = next;
        next.on("dragend", () => {
          const ll = next.getLatLng();
          onChangeRef.current(ll.lat, ll.lng);
        });
      };

      if (current.latitude != null && current.longitude != null) {
        bindMarker(
          leaflet.marker(start, { icon: pinIcon, draggable: true, autoPan: true }).addTo(instance),
        );
      }

      instance.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const L = LRef.current;
        const map = mapRef.current;
        if (!L || !map) return;
        if (!markerRef.current) {
          bindMarker(
            L.marker(e.latlng, { icon: pinIcon, draggable: true, autoPan: true }).addTo(instance),
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
    };
  }, []);

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
      const pinIcon = L.divIcon({
        className: "catch-map-pin",
        html: PIN_HTML,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker(next, { icon: pinIcon, draggable: true, autoPan: true }).addTo(map);
      markerRef.current = marker;
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        onChangeRef.current(ll.lat, ll.lng);
      });
    }
    if (jumped) map.setView([latitude, longitude], Math.max(map.getZoom(), 10));
  }, [latitude, longitude]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/assist/place?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a lake, ramp, or coast"
          className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-xl bg-teal px-3 py-2 text-sm font-semibold text-white"
          disabled={searching}
        >
          {searching ? "…" : "Find"}
        </button>
      </form>
      {results.length ? (
        <ul className="space-y-1">
          {results.map((hit) => (
            <li key={`${hit.latitude},${hit.longitude}`}>
              <button
                type="button"
                className="w-full rounded-xl bg-paper-deep px-3 py-2 text-left text-sm"
                onClick={() => {
                  onChange(hit.latitude, hit.longitude);
                  setQuery(hit.placeName);
                  setResults([]);
                }}
              >
                {hit.placeName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div ref={ref} className="h-56 w-full overflow-hidden rounded-2xl border border-line" />
      <p className="text-xs text-ink-muted">
        {hasPin
          ? "Drag the pin or tap a new spot. It stays editable."
          : "No pin yet — tap the map to place this catch."}
      </p>
    </div>
  );
}
