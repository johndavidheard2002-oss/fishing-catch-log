"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";
import { hasSavedPin, type LocationMapTarget } from "@/lib/location-map";
export type { LocationMapTarget } from "@/lib/location-map";
export {
  hasSavedPin,
  targetFromBait,
  targetFromBaitGroup,
  targetFromCatch,
  targetFromSpotGroup,
} from "@/lib/location-map";

const SpotMap = dynamic(() => import("@/components/SpotMap").then((m) => m.SpotMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-2xl border border-line bg-paper-deep text-sm text-ink-muted">
      Loading map…
    </div>
  ),
});

export function LocationMapSheet({
  target,
  onClose,
  testId,
  emptyTestId,
}: {
  target: LocationMapTarget | null;
  onClose: () => void;
  testId?: string;
  emptyTestId?: string;
}) {
  useEffect(() => {
    if (!target) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  if (!target) return null;

  const hasPin = hasSavedPin(target.latitude, target.longitude);
  const selectedKey = target.spots[0]?.key ?? null;
  const sheetTestId =
    testId ?? (target.kind === "catch" ? "calendar-catch-map" : "location-map");
  const emptyId =
    emptyTestId ?? (target.kind === "catch" ? "calendar-catch-map-empty" : "location-map-empty");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-map-title"
      data-testid={sheetTestId}
      data-no-tab-swipe
      onClick={onClose}
    >
      <div
        className="journal-card w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-copper">
              {target.kind === "bait" ? "Bait hole" : "Catch location"}
            </p>
            <h3 id="location-map-title" className="font-display text-xl text-teal">
              {target.title}
            </h3>
            <p className="mt-1 text-xs text-ink-muted">{target.place}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-3 py-1 text-xs font-semibold"
          >
            Close
          </button>
        </div>
        <div className="space-y-2 px-3 pb-3">
          {hasPin ? (
            <SpotMap
              spots={target.spots}
              baitSpots={target.baitSpots}
              selectedKey={selectedKey}
              className="h-72 w-full overflow-hidden rounded-2xl border border-line bg-paper-deep"
            />
          ) : (
            <p
              className="rounded-2xl border border-line bg-paper-deep px-3 py-6 text-sm text-ink-muted"
              data-testid={emptyId}
            >
              {target.kind === "bait"
                ? "This bait hole has no saved pin. Open it to drop one on the map."
                : "This catch has no saved pin. Open the trip to drop one on the map."}
            </p>
          )}
          {target.href ? (
            <Link
              href={target.href}
              className="block rounded-2xl border border-line bg-card px-4 py-3 text-center text-sm font-semibold"
            >
              {target.hrefLabel ?? "Open"}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
