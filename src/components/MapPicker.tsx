"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { placeName: string; latitude: number; longitude: number }[]
  >([]);
  const [searching, setSearching] = useState(false);

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
        latitude != null ? 9 : 5,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(instance);

      const marker = L.circleMarker(start, {
        radius: 9,
        color: "#c45c26",
        fillColor: "#c45c26",
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(instance);

      instance.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng);
        onChange(e.latlng.lat, e.latlng.lng);
      });
      map = instance;
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // Recreate when coords jump from search/geolocation, not on every keystroke.
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
      <p className="text-xs text-ink-muted">Tap the map to drop a pin. Drag by tapping a new spot.</p>
    </div>
  );
}
