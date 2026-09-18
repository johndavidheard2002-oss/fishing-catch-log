"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AreaNamePicker } from "./AreaNamePicker";
import { useTownMapFocus } from "./useTownMapFocus";
import { savedPinFromNamedArea } from "@/lib/areas";
import type { PlanDayTidePin } from "@/lib/plan-tide-pin";
import type { NamedArea } from "@/lib/types";

const MapPicker = dynamic(() => import("./MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-2xl border border-line bg-paper-deep text-sm text-ink-muted">
      Loading map…
    </div>
  ),
});

export function PlanDaySpotMap({
  pin,
  tideDetail,
  weatherDetail,
  onChangePin,
}: {
  pin: PlanDayTidePin | null;
  tideDetail: string;
  weatherDetail: string;
  onChangePin: (pin: PlanDayTidePin) => void;
}) {
  const hasPin = pin != null;
  const { focusCenter, lookupTown } = useTownMapFocus(hasPin);
  const [placeName, setPlaceName] = useState(pin?.placeName ?? "");

  function emitPin(latitude: number, longitude: number, name = placeName) {
    onChangePin({
      latitude,
      longitude,
      placeName: name.trim() ? name.trim() : null,
    });
  }

  async function onMapPin(latitude: number, longitude: number) {
    emitPin(latitude, longitude, placeName);
    if (placeName.trim()) return;
    try {
      const res = await fetch("/api/assist/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude }),
      });
      const data = res.ok ? await res.json() : null;
      const named = typeof data?.place?.placeName === "string" ? data.place.placeName.trim() : "";
      if (!named) return;
      setPlaceName(named);
      emitPin(latitude, longitude, named);
    } catch {
      /* reverse geocode is optional */
    }
  }

  function onPickArea(area: NamedArea) {
    setPlaceName(area.name);
    const saved = savedPinFromNamedArea(area);
    if (saved) emitPin(saved.latitude, saved.longitude, area.name);
  }

  return (
    <section
      className="journal-card min-w-0 space-y-3 overflow-visible rounded-2xl p-3"
      data-testid="plan-day-map"
      data-no-tab-swipe
    >
      <p className="text-sm font-semibold text-teal">Pick a spot to view tides and weather.</p>
      <AreaNamePicker
        value={placeName}
        onChange={(name) => {
          setPlaceName(name);
          if (pin) emitPin(pin.latitude, pin.longitude, name);
        }}
        onPickArea={onPickArea}
        onLookupTown={lookupTown}
        hasPin={hasPin}
      />
      <MapPicker
        latitude={pin?.latitude ?? null}
        longitude={pin?.longitude ?? null}
        onChange={onMapPin}
        focusCenter={focusCenter}
      />
      {tideDetail ? (
        <p data-testid="plan-day-map-tides" className="text-sm font-semibold text-teal">
          {tideDetail}
        </p>
      ) : null}
      {weatherDetail ? (
        <p data-testid="plan-day-map-weather" className="text-sm font-semibold text-teal">
          {weatherDetail}
        </p>
      ) : null}
      {hasPin && !tideDetail && !weatherDetail ? (
        <p className="text-xs text-ink-muted" data-testid="plan-day-map-tides-empty">
          Looking up tides and weather…
        </p>
      ) : null}
    </section>
  );
}
