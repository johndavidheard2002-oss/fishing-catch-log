import { DAY_KEY_RE, normalizeNotePlace } from "./notes";
import {
  clampHeightToExtremes,
  directionFromTide,
  formatSameTideLabel,
  formatTideClock,
  formatTideDetail,
  heightAndDirectionAt,
  pickSameTideMatch,
  sameTideCrossings,
  sameTideMatches,
  timeZoneFromLongitude,
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

/** Partial journal rows — habitat can be missing on older or client-built catches. */
export type PlannedTideJournalCatch = Omit<CatchRecord, "habitat"> & {
  habitat?: Habitat | string | null;
};

export type PlannedTideJournal = {
  catches?: PlannedTideJournalCatch[];
  baitSpots?: BaitSpot[];
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
  journal: PlannedTideJournal = {},
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

function finiteCoord(
  value: number | string | null | undefined,
): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function pinFromRecord(
  record:
    | {
        latitude?: number | string | null;
        longitude?: number | string | null;
        photoTakenLatitude?: number | string | null;
        photoTakenLongitude?: number | string | null;
        habitat?: Habitat | string | null;
        tideHeightFt?: number | null;
        tide?: string | null;
        caughtAt?: string | null;
      }
    | null
    | undefined,
  caughtAt: string | null,
): PlannedTidePin | null {
  const latitude = finiteCoord(record?.latitude) ?? finiteCoord(record?.photoTakenLatitude);
  const longitude = finiteCoord(record?.longitude) ?? finiteCoord(record?.photoTakenLongitude);
  if (latitude == null || longitude == null) return null;
  const clock = caughtAt ?? record?.caughtAt ?? null;
  return {
    latitude,
    longitude,
    habitat: record?.habitat ?? null,
    caughtAt: clock && !Number.isNaN(new Date(clock).getTime()) ? clock : null,
    tideHeightFt: record?.tideHeightFt ?? null,
    tide: record?.tide ?? null,
  };
}

/** High/Low series for chips — synthesize from the Planned header when NOAA omitted extremes. */
export function extremesForChip(snap: TideSnapshot | null | undefined): NonNullable<TideSnapshot["extremes"]> {
  const raw = snap?.extremes ?? [];
  if (raw.length >= 2) return raw;
  const built: NonNullable<TideSnapshot["extremes"]> = [];
  if (snap?.nextLowAt && snap.nextLowFt != null && Number.isFinite(snap.nextLowFt)) {
    built.push({ at: snap.nextLowAt, type: "low", heightFt: snap.nextLowFt });
  }
  if (snap?.nextHighAt && snap.nextHighFt != null && Number.isFinite(snap.nextHighFt)) {
    built.push({ at: snap.nextHighAt, type: "high", heightFt: snap.nextHighFt });
  }
  return built.length >= 2 ? built : raw.length ? raw : built;
}

/** Last-resort chip from the day's High/Low so a planned photo is never blank. */
export function fallbackChipFromDayTides(
  snap: TideSnapshot | null | undefined,
  day?: string,
  timeZone?: string,
  prefer?: string | null,
): string {
  if (!snap?.applies) return "";
  const extremes = extremesForChip(snap);
  const preferDir = directionFromTide(prefer);
  if (extremes.length >= 2) {
    const height =
      snap.heightFt != null && Number.isFinite(snap.heightFt)
        ? clampHeightToExtremes(extremes, snap.heightFt) ?? snap.heightFt
        : clampHeightToExtremes(extremes, 0) ?? extremes[0]?.heightFt;
    if (height != null && Number.isFinite(height)) {
      let matches = day ? sameTideMatches(extremes, height, day, timeZone) : [];
      if (!matches.length) matches = sameTideCrossings(extremes, height);
      const match =
        pickSameTideMatch(matches, preferDir, null, timeZone) ??
        pickSameTideMatch(matches, null, null, timeZone);
      const label = formatSameTideLabel(match, timeZone);
      if (label) return label;
    }
  }
  const low = formatTideClock(snap.nextLowAt, timeZone);
  const high = formatTideClock(snap.nextHighAt, timeZone);
  if (preferDir === "falling" && high) return `High ${high}`;
  if (preferDir === "rising" && low) return `${low} incoming`;
  if (low) return `${low} incoming`;
  if (high) return `High ${high}`;
  return "";
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
  if (!snap?.applies) return "";
  const zone = timeZoneFromLongitude(pin?.longitude);
  const extremes = extremesForChip(snap);
  if (pin && extremes.length >= 2) {
    const preferAt = pin.caughtAt ? new Date(pin.caughtAt) : null;
    const mapped = planDayReferenceAt(day, pin.caughtAt);
    const sampled = mapped ? heightAndDirectionAt(extremes, mapped) : null;
    let height = pin.tideHeightFt;
    if (height == null || !Number.isFinite(height)) {
      height = sampled?.heightFt ?? clampHeightToExtremes(extremes, 0);
    }
    if (height != null && Number.isFinite(height)) {
      const prefer =
        directionFromTide(pin.tide) ??
        (sampled ? (sampled.direction === "rising" ? "incoming" : "outgoing") : null);
      const preferDir = directionFromTide(prefer);
      const clock = preferAt && !Number.isNaN(preferAt.getTime()) ? preferAt : mapped;
      let matches = sameTideMatches(extremes, height, day, zone);
      if (!matches.length) {
        const clamped = clampHeightToExtremes(extremes, height);
        if (clamped != null) {
          matches = sameTideMatches(extremes, clamped, day, zone);
          if (!matches.length) {
            matches = sameTideCrossings(extremes, clamped);
          }
        }
      }
      const match =
        pickSameTideMatch(matches, preferDir, clock, zone) ??
        pickSameTideMatch(matches, null, clock, zone);
      const label = formatSameTideLabel(match, zone);
      if (label) return label;
    }
  }
  return fallbackChipFromDayTides(snap, day, zone, pin?.tide);
}

/** One same-tide chip per planned row — never collapse multiple fish at a hole. */
export function sameTideChipsForSpots(
  spots: Array<{ id: string; placeName?: string | null; sourceCatchId?: string | null; sourceBaitId?: string | null }>,
  snap: TideSnapshot | null | undefined,
  day: string,
  journal: PlannedTideJournal = {},
  catchSnaps: Record<string, TideSnapshot | null | undefined> = {},
): Record<string, string> {
  const chips: Record<string, string> = {};
  if (!snap?.applies) return chips;
  const pins = spots.map((spot) => pinForPlannedSpot(spot, journal));
  const fallbackPin = pins.find((pin) => pin != null) ?? null;
  const zone = timeZoneFromLongitude(fallbackPin?.longitude);
  spots.forEach((spot, index) => {
    const own = pins[index];
    const pin = own ?? fallbackPin;
    const lookup = pin ? catchTideLookupKey(pin) : null;
    const resolved = pin && lookup ? applyCatchTideSnapshot(pin, catchSnaps[lookup]) : pin;
    let label = plannedSpotSameTide(snap, day, resolved);
    if (!label && fallbackPin && resolved !== fallbackPin) {
      const fbKey = catchTideLookupKey(fallbackPin);
      const fb = fbKey ? applyCatchTideSnapshot(fallbackPin, catchSnaps[fbKey]) : fallbackPin;
      label = plannedSpotSameTide(snap, day, fb);
    }
    if (!label) label = fallbackChipFromDayTides(snap, day, zone, resolved?.tide);
    if (label) chips[spot.id] = label;
  });
  return chips;
}
