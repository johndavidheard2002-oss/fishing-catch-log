"use client";

import { useEffect, useState } from "react";
import {
  catchRecordTideHeightLabel,
  catchTideLookupKey,
  pinFromTideRecord,
} from "@/lib/plan-tides";
import { tidesApplyToHabitat, type TideSnapshot } from "@/lib/tides/snapshot";
import type { CatchRecord } from "@/lib/types";

/** Same compact corner chip Plan uses on planned catch photos. */
export const PHOTO_TIDE_HEIGHT_BADGE_CLASS =
  "pointer-events-none absolute right-0.5 bottom-0.5 z-[5] rounded bg-ink/80 px-1 py-px text-[10px] font-bold leading-none text-white shadow";

const snapCache = new Map<string, TideSnapshot | null>();
const inflight = new Map<string, Promise<TideSnapshot | null>>();

export function PhotoTideHeightBadge({
  label,
  testId,
}: {
  label: string | null | undefined;
  testId: string;
}) {
  if (!label) return null;
  return (
    <span className={PHOTO_TIDE_HEIGHT_BADGE_CLASS} data-testid={testId}>
      {label}
    </span>
  );
}

async function loadCatchTideSnap(record: CatchRecord): Promise<TideSnapshot | null> {
  const pin = pinFromTideRecord(record);
  const key = catchTideLookupKey(pin);
  if (!pin?.caughtAt || !key) return null;
  if (snapCache.has(key)) return snapCache.get(key) ?? null;
  const pending = inflight.get(key);
  if (pending) return pending;
  const req = fetch("/api/assist/weather", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: pin.latitude,
      longitude: pin.longitude,
      at: pin.caughtAt,
      habitat: tidesApplyToHabitat(record.habitat) ? record.habitat : "saltwater-inshore",
    }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data?.tide as TideSnapshot | undefined) ?? null)
    .catch(() => null)
    .then((snap) => {
      snapCache.set(key, snap);
      inflight.delete(key);
      return snap;
    });
  inflight.set(key, req);
  return req;
}

/** Logged height now; NOAA/sample at the catch clock only when that is unknown. */
export function CatchPhotoTideHeightBadge({ record }: { record: CatchRecord }) {
  const logged = catchRecordTideHeightLabel(record);
  const [sampled, setSampled] = useState<string | null>(null);

  useEffect(() => {
    if (logged) return;
    if (!tidesApplyToHabitat(record.habitat)) return;
    let cancelled = false;
    void loadCatchTideSnap(record).then((snap) => {
      if (cancelled || !snap) return;
      setSampled(catchRecordTideHeightLabel(record, snap));
    });
    return () => {
      cancelled = true;
    };
  }, [
    logged,
    record.habitat,
    record.latitude,
    record.longitude,
    record.photoTakenLatitude,
    record.photoTakenLongitude,
    record.caughtAt,
    record.tideHeightFt,
    record.tide,
  ]);

  return (
    <PhotoTideHeightBadge
      label={logged ?? sampled}
      testId="calendar-catch-photo-tide-height"
    />
  );
}
