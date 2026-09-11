import { DAY_KEY_RE, normalizeNotePlace } from "./notes";
import {
  clampHeightToExtremes,
  directionFromTide,
  formatSameTideLabel,
  formatTideDetail,
  heightAndDirectionAt,
  pickSameTideMatch,
  sameTideMatches,
  timeZoneFromLongitude,
  tidesApplyToHabitat,
  type TideSnapshot,
} from "./tides/snapshot";
import type { BaitSpot, CatchRecord, Habitat } from "./types";

export type PlannedTidePin = {
  latitude: number;
  longitude: number;
  habitat: Habitat | string | null;
  caughtAt: string | null;
  tideHeightFt: number | null;
  tide: string | null;
};

/** Map a catch/bait clock onto the planned YYYY-MM-DD (UTC). Noon-ish if none. */
export function planDayReferenceAt(day: string, caughtAt?: string | null): Date | null {
  if (!DAY_KEY_RE.test(day)) return null;
  if (caughtAt) {
    const src = new Date(caughtAt);
    if (!Number.isNaN(src.getTime())) {
      const hh = String(src.getUTCHours()).padStart(2, "0");
      const mm = String(src.getUTCMinutes()).padStart(2, "0");
      const ss = String(src.getUTCSeconds()).padStart(2, "0");
      const mapped = new Date(`${day}T${hh}:${mm}:${ss}.000Z`);
      if (!Number.isNaN(mapped.getTime())) return mapped;
    }
  }
  return new Date(`${day}T16:00:00.000Z`);
}

export function pinForPlannedSpot(
  spot: {
    placeName?: string | null;
    sourceCatchId?: string | null;
    sourceBaitId?: string | null;
  },
  journal: { catches?: CatchRecord[]; baitSpots?: BaitSpot[] } = {},
): PlannedTidePin | null {
  const catchId = spot.sourceCatchId?.trim();
  const baitId = spot.sourceBaitId?.trim();
  if (catchId) {
    const record = journal.catches?.find((row) => row.id === catchId);
    const pin = pinFromRecord(record, record?.caughtAt ?? null);
    if (pin) return pin;
  }
  if (baitId) {
    const record = journal.baitSpots?.find((row) => row.id === baitId);
    const pin = pinFromRecord(record, record?.loggedAt ?? null);
    if (pin) return pin;
  }
  const place = normalizeNotePlace(spot.placeName);
  if (!place) return null;
  const byPlaceCatch = journal.catches?.find(
    (row) => normalizeNotePlace(row.placeName) === place && row.latitude != null && row.longitude != null,
  );
  const fromCatch = pinFromRecord(byPlaceCatch, byPlaceCatch?.caughtAt ?? null);
  if (fromCatch) return fromCatch;
  const byPlaceBait = journal.baitSpots?.find(
    (row) => normalizeNotePlace(row.placeName) === place && row.latitude != null && row.longitude != null,
  );
  return pinFromRecord(byPlaceBait, byPlaceBait?.loggedAt ?? null);
}

function pinFromRecord(
  record:
    | {
        latitude?: number | null;
        longitude?: number | null;
        habitat?: Habitat | string | null;
        tideHeightFt?: number | null;
        tide?: string | null;
      }
    | null
    | undefined,
  caughtAt: string | null,
): PlannedTidePin | null {
  if (record?.latitude == null || record.longitude == null) return null;
  if (!Number.isFinite(record.latitude) || !Number.isFinite(record.longitude)) return null;
  return {
    latitude: record.latitude,
    longitude: record.longitude,
    habitat: record.habitat ?? null,
    caughtAt,
    tideHeightFt: record.tideHeightFt ?? null,
    tide: record.tide ?? null,
  };
}

export function plannedDayTideDetail(
  snap: TideSnapshot | null | undefined,
  longitude?: number | null,
): string {
  if (!snap?.applies) return "";
  return formatTideDetail({ ...snap, longitude });
}

/** Prefer height/stage from a catch-time lookup at this pin’s station. */
export function applyCatchTideSnapshot(
  pin: PlannedTidePin,
  catchSnap?: TideSnapshot | null,
): PlannedTidePin {
  if (!catchSnap?.applies) return pin;
  return {
    ...pin,
    tideHeightFt: catchSnap.heightFt ?? pin.tideHeightFt,
    tide: catchSnap.tide ?? pin.tide,
  };
}

export function catchTideLookupKey(pin: PlannedTidePin): string | null {
  if (!pin.caughtAt) return null;
  return `${pin.latitude.toFixed(4)},${pin.longitude.toFixed(4)},${pin.caughtAt}`;
}

/**
 * Plan-day clock when tide height equals the catch’s height (interpolated)
 * and incoming/outgoing matches the catch. Not nearest High/Low.
 */
export function plannedSpotSameTide(
  snap: TideSnapshot | null | undefined,
  day: string,
  pin: PlannedTidePin | null,
): string {
  if (!snap?.applies || !pin || !tidesApplyToHabitat(pin.habitat)) return "";
  const zone = timeZoneFromLongitude(pin.longitude);
  const preferAt = pin.caughtAt ? new Date(pin.caughtAt) : null;
  const mapped = planDayReferenceAt(day, pin.caughtAt);
  const sampled =
    mapped && snap.extremes?.length ? heightAndDirectionAt(snap.extremes, mapped) : null;
  let height = pin.tideHeightFt;
  if (height == null || !Number.isFinite(height)) {
    height = sampled?.heightFt ?? clampHeightToExtremes(snap.extremes, 0);
  }
  if (height == null || !Number.isFinite(height)) return "";
  const prefer =
    directionFromTide(pin.tide) ??
    (sampled ? (sampled.direction === "rising" ? "incoming" : "outgoing") : null);
  let matches = sameTideMatches(snap.extremes, height, day, zone);
  if (!matches.length) {
    const clamped = clampHeightToExtremes(snap.extremes, height);
    if (clamped != null) {
      matches = sameTideMatches(snap.extremes, clamped, day, zone);
    }
  }
  const match = pickSameTideMatch(
    matches,
    directionFromTide(prefer),
    preferAt && !Number.isNaN(preferAt.getTime()) ? preferAt : mapped,
    zone,
  );
  return formatSameTideLabel(match, zone);
}

/** One same-tide chip per planned row — never collapse multiple fish at a hole. */
export function sameTideChipsForSpots(
  spots: Array<{ id: string; placeName?: string | null; sourceCatchId?: string | null; sourceBaitId?: string | null }>,
  snap: TideSnapshot | null | undefined,
  day: string,
  journal: { catches?: CatchRecord[]; baitSpots?: BaitSpot[] } = {},
  catchSnaps: Record<string, TideSnapshot | null | undefined> = {},
): Record<string, string> {
  const chips: Record<string, string> = {};
  const pins = spots.map((spot) => pinForPlannedSpot(spot, journal));
  const fallbackPin = pins.find((pin) => pin != null) ?? null;
  spots.forEach((spot, index) => {
    const pin = pins[index] ?? fallbackPin;
    if (!pin) return;
    const lookup = catchTideLookupKey(pin);
    const resolved = lookup ? applyCatchTideSnapshot(pin, catchSnaps[lookup]) : pin;
    const label = plannedSpotSameTide(snap, day, resolved);
    if (label) chips[spot.id] = label;
  });
  return chips;
}
