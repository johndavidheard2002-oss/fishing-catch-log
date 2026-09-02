"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const PIN_HTML =
  '<div style="width:18px;height:18px;border-radius:50%;background:#c45c26;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>';

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
    const el = ref.current;
    if (!el) return;
    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el) return;
      const start: [number, number] =
        latitude != null && longitude != null ? [latitude, longitude] : [28.5, -81.3];
      const instance = L.map(el, { zoomControl: true }).setView(
        start,
        latitude != null && longitude != null ? 13 : 5,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(instance);

      const pinIcon = L.divIcon({
        className: "catch-map-pin",
        html: PIN_HTML,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      type PinMarker = {
        setLatLng: (ll: { lat: number; lng: number }) => void;
        getLatLng: () => { lat: number; lng: number };
        on: (ev: string, fn: () => void) => void;
      };
      let marker: PinMarker | null = null;

      const bindMarker = (next: PinMarker) => {
        marker = next;
        marker.on("dragend", () => {
          const ll = marker!.getLatLng();
          onChangeRef.current(ll.lat, ll.lng);
        });
      };

      if (latitude != null && longitude != null) {
        bindMarker(
          L.marker(start, { icon: pinIcon, draggable: true, autoPan: true }).addTo(instance),
        );
      }

      instance.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        if (!marker) {
          bindMarker(
            L.marker(e.latlng, { icon: pinIcon, draggable: true, autoPan: true }).addTo(instance),
          );
        } else {
          marker.setLatLng(e.latlng);
        }
        onChangeRef.current(e.latlng.lat, e.latlng.lng);
      });
      map = instance;
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // Recreate when coords jump from search/photo GPS, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude == null ? "" : latitude.toFixed(3), longitude == null ? "" : longitude.toFixed(3)]);

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
