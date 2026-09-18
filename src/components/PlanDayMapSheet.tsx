"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AreaNamePicker } from "./AreaNamePicker";
import { useTownMapFocus } from "./useTownMapFocus";
import { savedPinFromNamedArea } from "@/lib/areas";
import { formatWeekdayDate } from "@/lib/time";
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

export function PlanDayMapSheet({
  day,
  pin,
  tideDetail,
  onChangePin,
  onClose,
}: {
  day: string;
  pin: PlanDayTidePin | null;
  tideDetail: string;
  onChangePin: (pin: PlanDayTidePin) => void;
  onClose: () => void;
}) {
  const hasPin = pin != null;
  const { focusCenter, lookupTown } = useTownMapFocus(hasPin);
  const [placeName, setPlaceName] = useState(pin?.placeName ?? "");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  const sheet = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-day-map-title"
      data-testid="plan-day-map"
      data-no-tab-swipe
      onClick={onClose}
    >
      <div
        className="journal-card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-copper">
              Pin for tides
            </p>
            <h3 id="plan-day-map-title" className="font-display text-xl text-teal">
              {formatWeekdayDate(day)}
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              Drop a pin on the water. We load that day’s High and Low for this spot.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-3 py-1 text-xs font-semibold"
            data-testid="plan-day-map-close"
          >
            Close
          </button>
        </div>
        <div className="space-y-3 px-3 pb-3">
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
          ) : (
            <p className="text-xs text-ink-muted" data-testid="plan-day-map-tides-empty">
              {hasPin
                ? "Looking up tides for this pin…"
                : "Tap the map or reuse a past name, then that day’s tides show here."}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-teal px-4 py-3 text-sm font-semibold text-white"
            data-testid="plan-day-map-done"
          >
            {hasPin ? "Use this pin" : "Skip for now"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? sheet : createPortal(sheet, document.body);
}
