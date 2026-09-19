import { DAY_KEY_RE, normalizeNotePlace } from "./notes";
import {
  civilDateKey,
  directionFromDayPhase,
  explicitFloodEbbDirection,
  formatSameTideLabel,
  formatTideClock,
  formatTideDetail,
  heightAndDirectionAt,
  incomingOutgoingLabel,
  pickSameTideMatch,
  parseTideExtremes,
  sameDirectionMatches,
  sameTideMatches,
  timeZoneFromLongitude,
  type SameTideMatch,
  type TideDirection,
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

export type PlannedTideSpot = {
  id: string;
  placeName?: string | null;
  sourceCatchId?: string | null;
  sourceBaitId?: string | null;
};

/** Partial journal rows — habitat can be missing on older or client-built catches. */
export type PlannedTideJournalCatch = Omit<CatchRecord, "habitat"> & {
  habitat?: Habitat | string | null;
};

export type PlannedTideJournal = {
  catches?: PlannedTideJournalCatch[];
  baitSpots?: BaitSpot[];
};

type TideRecord = {
  latitude?: number | string | null;
  longitude?: number | string | null;
  photoTakenLatitude?: number | string | null;
  photoTakenLongitude?: number | string | null;
  placeName?: string | null;
  habitat?: Habitat | string | null;
  tideHeightFt?: number | null;
  tide?: string | null;
  caughtAt?: string | null;
  loggedAt?: string | null;
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
  station?: Pick<PlannedTidePin, "latitude" | "longitude"> | null,
): PlannedTidePin | null {
  const catchId = spot.sourceCatchId?.trim();
  const baitId = spot.sourceBaitId?.trim();
  if (catchId) {
    const record = journal.catches?.find((row) => row.id === catchId);
    if (!record) return null;
    return pinFromRecord(
      withBorrowedCoords(record, journal, spot.placeName, station),
      record.caughtAt ?? null,
    );
  }
  if (baitId) {
    const record = journal.baitSpots?.find((row) => row.id === baitId);
    if (!record) return null;
    return pinFromRecord(
      withBorrowedCoords(record, journal, spot.placeName, station),
      record.loggedAt ?? null,
    );
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

function recordCoords(record: TideRecord | null | undefined): {
  latitude: number;
  longitude: number;
} | null {
  const latitude = finiteCoord(record?.latitude) ?? finiteCoord(record?.photoTakenLatitude);
  const longitude = finiteCoord(record?.longitude) ?? finiteCoord(record?.photoTakenLongitude);
  if (latitude == null || longitude == null) return null;
  return { latitude, longitude };
}

function locatedCoords(
  journal: PlannedTideJournal,
  place?: string | null,
  station?: Pick<PlannedTidePin, "latitude" | "longitude"> | null,
): { latitude: number; longitude: number } | null {
  const placeKey = normalizeNotePlace(place);
  const records: TideRecord[] = [...(journal.catches ?? []), ...(journal.baitSpots ?? [])];
  if (placeKey) {
    for (const row of records) {
      if (normalizeNotePlace(row.placeName) !== placeKey) continue;
      const coords = recordCoords(row);
      if (coords) return coords;
    }
  }
  if (station && Number.isFinite(station.latitude) && Number.isFinite(station.longitude)) {
    return { latitude: station.latitude, longitude: station.longitude };
  }
  for (const row of records) {
    const coords = recordCoords(row);
    if (coords) return coords;
  }
  return null;
}

function withBorrowedCoords(
  record: TideRecord,
  journal: PlannedTideJournal,
  place?: string | null,
  station?: Pick<PlannedTidePin, "latitude" | "longitude"> | null,
): TideRecord {
  if (recordCoords(record)) return record;
  const coords = locatedCoords(journal, record.placeName ?? place, station);
  if (!coords) return record;
  return { ...record, latitude: coords.latitude, longitude: coords.longitude };
}

function pinFromRecord(
  record: TideRecord | null | undefined,
  caughtAt: string | null,
): PlannedTidePin | null {
  const coords = recordCoords(record);
  if (!coords) return null;
  const clock = caughtAt ?? record?.caughtAt ?? null;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    habitat: record?.habitat ?? null,
    caughtAt: clock && !Number.isNaN(new Date(clock).getTime()) ? clock : null,
    tideHeightFt: record?.tideHeightFt ?? null,
    tide: record?.tide ?? null,
  };
}

/** Catch or bait row → the same pin Plan uses for height badges. */
export function pinFromTideRecord(
  record: TideRecord | null | undefined,
  caughtAt?: string | null,
): PlannedTidePin | null {
  return pinFromRecord(record, caughtAt ?? record?.caughtAt ?? record?.loggedAt ?? null);
}

/** Fetch the full catch when Plan only has a partial suggestion row (no clock, pin, or flood/ebb). */
export function catchNeedsPlanTideFetch(row?: PlannedTideJournalCatch | null): boolean {
  if (!row) return true;
  const clock = row.caughtAt;
  if (!clock || Number.isNaN(new Date(clock).getTime())) return true;
  if (recordCoords(row) == null) return true;
  return explicitFloodEbbDirection(row.tide) == null;
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

function applyDayPhase(
  match: SameTideMatch,
  extremes: Parameters<typeof parseTideExtremes>[0],
  timeZone?: string,
): SameTideMatch {
  const phase = directionFromDayPhase(extremes, match.at, timeZone);
  if (!phase || phase === match.direction) return match;
  return { ...match, direction: phase };
}

function matchFitsPrefer(
  match: SameTideMatch,
  preferDir: TideDirection | null,
  extremes: Parameters<typeof parseTideExtremes>[0],
  timeZone?: string,
): boolean {
  if (preferDir && match.direction !== preferDir) return false;
  const phase = directionFromDayPhase(extremes, match.at, timeZone);
  if (preferDir && phase && phase !== preferDir) return false;
  return true;
}

function chipFromMatches(
  matches: SameTideMatch[],
  preferDir: TideDirection | null,
  clock: Date | null,
  timeZone: string | undefined,
  extremes: Parameters<typeof parseTideExtremes>[0],
  allowExtreme = true,
): string {
  // Known incoming/outgoing: never label the opposite flood/ebb as a matching tide.
  const pool = matches.filter((m) => matchFitsPrefer(m, preferDir, extremes, timeZone));
  const usable = allowExtreme ? pool : pool.filter((m) => !m.onExtreme);
  const match = pickSameTideMatch(usable, preferDir, clock, timeZone);
  if (!match) return "";
  return formatSameTideLabel(applyDayPhase(match, extremes, timeZone), timeZone);
}

function mappedClockChip(
  sampled: { heightFt: number; direction: TideDirection } | null,
  mapped: Date | null,
  timeZone: string | undefined,
  preferDir: TideDirection | null,
  extremes?: Parameters<typeof parseTideExtremes>[0],
): string {
  if (!sampled || !mapped) return "";
  if (preferDir && sampled.direction !== preferDir) return "";
  const phase = extremes ? directionFromDayPhase(extremes, mapped, timeZone) : null;
  if (preferDir && phase && phase !== preferDir) return "";
  return formatSameTideLabel(
    {
      at: mapped,
      direction: phase ?? sampled.direction,
      heightFt: sampled.heightFt,
      onExtreme: null,
    },
    timeZone,
  );
}

function isoOnCivilDay(
  iso: string | null | undefined,
  day: string | undefined,
  timeZone?: string,
): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  if (day && DAY_KEY_RE.test(day) && civilDateKey(at, timeZone) !== day) return null;
  return iso;
}

/** That plan day's High/Low clocks only — never a leftover from the NOAA window. */
function dayHighLowChip(
  snap: TideSnapshot,
  day: string | undefined,
  timeZone?: string,
  preferDir: TideDirection | null = null,
): string {
  const onDay = parseTideExtremes(extremesForChip(snap)).filter((row) => {
    if (!day || !DAY_KEY_RE.test(day)) return true;
    return civilDateKey(row.at, timeZone) === day;
  });
  const highIso =
    onDay.find((row) => row.type === "high")?.at.toISOString() ??
    isoOnCivilDay(snap.nextHighAt, day, timeZone);
  const lowIso =
    onDay.find((row) => row.type === "low")?.at.toISOString() ??
    isoOnCivilDay(snap.nextLowAt, day, timeZone);
  const high = formatTideClock(highIso, timeZone);
  const low = formatTideClock(lowIso, timeZone);
  if (preferDir === "falling") return high ? `High ${high}` : "";
  if (preferDir === "rising") return low ? `${low} ${incomingOutgoingLabel("rising")}` : "";
  if (high) return `High ${high}`;
  if (low) return `${low} ${incomingOutgoingLabel("rising")}`;
  return "";
}

/**
 * Never-blank last resort on that plan day: interpolate the noon clock, then
 * that day's High/Low. Never `sameTideCrossings` across the NOAA window.
 */
export function fallbackChipFromDayTides(
  snap: TideSnapshot | null | undefined,
  day?: string,
  timeZone?: string,
  prefer?: string | null,
): string {
  if (!snap?.applies) return "";
  const extremes = extremesForChip(snap);
  const preferDir = explicitFloodEbbDirection(prefer);
  const mapped = day ? planDayReferenceAt(day, null) : null;
  const sampled = mapped && extremes.length >= 2 ? heightAndDirectionAt(extremes, mapped) : null;
  if (day && extremes.length >= 2) {
    if (sampled && Number.isFinite(sampled.heightFt)) {
      const matches = sameTideMatches(extremes, sampled.heightFt, day, timeZone);
      let label = chipFromMatches(matches, preferDir, mapped, timeZone, extremes);
      if (!label && preferDir) {
        label = chipFromMatches(
          sameDirectionMatches(extremes, sampled.heightFt, day, timeZone, preferDir),
          preferDir,
          mapped,
          timeZone,
          extremes,
        );
      }
      if (label) return label;
    }
    const mappedLabel = mappedClockChip(sampled, mapped, timeZone, preferDir, extremes);
    if (mappedLabel) return mappedLabel;
  }
  return dayHighLowChip(snap, day, timeZone, preferDir);
}

export function plannedDayTideDetail(
  snap: TideSnapshot | null | undefined,
  longitude?: number | null,
): string {
  if (!snap?.applies) return "";
  return formatTideDetail({ ...snap, longitude });
}

const HEIGHT_EPS = 0.001;

export type TideHeightRange = { min: number; max: number };

/** High/Low range on one civil day — not the leftover min/max of a multi-day NOAA window. */
export function tideHeightRangeForDay(
  snap: TideSnapshot | null | undefined,
  day?: string,
  timeZone?: string,
): TideHeightRange | null {
  const extremes = parseTideExtremes(extremesForChip(snap));
  const heights: number[] = [];
  const scoped = Boolean(day && DAY_KEY_RE.test(day));
  if (scoped) {
    for (const row of extremes) {
      if (civilDateKey(row.at, timeZone) === day) heights.push(row.heightFt);
    }
  }
  if (
    snap?.nextLowFt != null &&
    Number.isFinite(snap.nextLowFt) &&
    (!scoped || isoOnCivilDay(snap.nextLowAt, day, timeZone))
  ) {
    heights.push(snap.nextLowFt);
  }
  if (
    snap?.nextHighFt != null &&
    Number.isFinite(snap.nextHighFt) &&
    (!scoped || isoOnCivilDay(snap.nextHighAt, day, timeZone))
  ) {
    heights.push(snap.nextHighFt);
  }
  if (!heights.length && !scoped) {
    for (const row of extremes) heights.push(row.heightFt);
  }
  if (!heights.length) return null;
  return { min: Math.min(...heights), max: Math.max(...heights) };
}

export function remapHeightToRange(
  heightFt: number,
  from: TideHeightRange,
  to: TideHeightRange,
): number {
  const fromSpan = from.max - from.min;
  const toSpan = to.max - to.min;
  if (toSpan < HEIGHT_EPS) return to.min;
  if (fromSpan < HEIGHT_EPS) {
    return Math.min(to.max, Math.max(to.min, heightFt));
  }
  const t = (heightFt - from.min) / fromSpan;
  return to.min + Math.min(1, Math.max(0, t)) * toSpan;
}

function heightInRange(heightFt: number, range: TideHeightRange): boolean {
  return heightFt >= range.min - HEIGHT_EPS && heightFt <= range.max + HEIGHT_EPS;
}

function catchTideRange(
  catchSnap: TideSnapshot | null | undefined,
  pin: PlannedTidePin,
  timeZone?: string,
): TideHeightRange | null {
  if (!catchSnap?.applies) return null;
  const at = pin.caughtAt ? new Date(pin.caughtAt) : null;
  const day =
    at && !Number.isNaN(at.getTime()) ? civilDateKey(at, timeZone) : "";
  return tideHeightRangeForDay(catchSnap, day, timeZone);
}

function catchSampledAt(
  pin: PlannedTidePin | null | undefined,
  catchSnap?: TideSnapshot | null,
): { heightFt: number; direction: TideDirection } | null {
  if (!pin?.caughtAt || !catchSnap?.applies || (catchSnap.extremes?.length ?? 0) < 2) return null;
  const at = new Date(pin.caughtAt);
  if (Number.isNaN(at.getTime())) return null;
  return heightAndDirectionAt(catchSnap.extremes, at);
}

/** Logged catch height, then NOAA sample at that catch clock — not a plan-day remap. */
export function catchLoggedOrSampledHeight(
  pin: PlannedTidePin | null | undefined,
  catchSnap?: TideSnapshot | null,
): number | null {
  if (pin?.tideHeightFt != null && Number.isFinite(pin.tideHeightFt)) return pin.tideHeightFt;
  const sampled = catchSampledAt(pin, catchSnap);
  if (sampled && Number.isFinite(sampled.heightFt)) return sampled.heightFt;
  if (catchSnap?.heightFt != null && Number.isFinite(catchSnap.heightFt)) return catchSnap.heightFt;
  return null;
}

/**
 * Compact feet for a catch-photo badge. One decimal (house style), minus
 * without a leading zero so -0.5 ft reads `-.5`. Unknown → no badge.
 */
export function formatCatchTideHeightFt(heightFt: number | null | undefined): string | null {
  if (heightFt == null || !Number.isFinite(heightFt)) return null;
  const text = heightFt.toFixed(1);
  if (text === "-0.0") return "0.0";
  return text.replace(/^-0\./, "-.");
}

/** Same logged/sampled height the matching-tide chips use, formatted for the photo. */
export function plannedSpotTideHeightLabel(
  pin: PlannedTidePin | null | undefined,
  catchSnap?: TideSnapshot | null,
): string | null {
  return formatCatchTideHeightFt(catchLoggedOrSampledHeight(pin, catchSnap));
}

/**
 * Calendar Log / catch-card height. Logged `tideHeightFt` first (even without a
 * pin), then NOAA/sample at the catch clock. Unknown → no badge.
 */
export function catchRecordTideHeightLabel(
  record: TideRecord | null | undefined,
  catchSnap?: TideSnapshot | null,
): string | null {
  if (!record) return null;
  const logged = formatCatchTideHeightFt(record.tideHeightFt);
  if (logged) return logged;
  return plannedSpotTideHeightLabel(pinFromTideRecord(record), catchSnap);
}

/** Flood/ebb from the past catch — never High/Low, never a wrong-limb plan-day clock. */
export function catchFloodEbbDirection(
  pin: PlannedTidePin | null | undefined,
  catchSnap?: TideSnapshot | null,
  planExtremes?: Parameters<typeof parseTideExtremes>[0],
  mapped?: Date | null,
  timeZone?: string,
): TideDirection | null {
  const sampled = catchSampledAt(pin, catchSnap);
  const catchAt = pin?.caughtAt ? new Date(pin.caughtAt) : null;
  const catchPhase =
    catchAt && !Number.isNaN(catchAt.getTime()) && catchSnap?.extremes?.length
      ? directionFromDayPhase(catchSnap.extremes, catchAt, timeZone)
      : null;
  return (
    explicitFloodEbbDirection(pin?.tide) ??
    sampled?.direction ??
    explicitFloodEbbDirection(catchSnap?.tide) ??
    catchPhase ??
    (mapped ? directionFromDayPhase(planExtremes, mapped, timeZone) : null)
  );
}

/** Prefer height/stage from a catch-time lookup at this pin’s station. */
export function applyCatchTideSnapshot(
  pin: PlannedTidePin,
  catchSnap?: TideSnapshot | null,
): PlannedTidePin {
  if (!catchSnap?.applies) return pin;
  let height = catchSnap.heightFt ?? pin.tideHeightFt;
  const sampled =
    pin.caughtAt && (catchSnap.extremes?.length ?? 0) >= 2
      ? heightAndDirectionAt(catchSnap.extremes, new Date(pin.caughtAt))
      : null;
  if (sampled && (catchSnap.heightFt == null || !Number.isFinite(catchSnap.heightFt))) {
    height = sampled.heightFt;
  }
  // Explicit flood/ebb on the catch wins. High/Low + a near-extreme snapshot
  // must not overwrite a falling-limb sample with incoming.
  let tide = explicitFloodEbbDirection(pin.tide) ? pin.tide : null;
  if (!tide && sampled) {
    tide = sampled.direction === "rising" ? "incoming" : "outgoing";
  }
  if (!tide) {
    tide = explicitFloodEbbDirection(catchSnap.tide) ? catchSnap.tide : pin.tide;
  }
  return {
    ...pin,
    tideHeightFt: height ?? pin.tideHeightFt,
    tide: tide ?? pin.tide,
  };
}

export function catchTideLookupKey(pin: PlannedTidePin | null | undefined): string | null {
  if (!pin?.caughtAt) return null;
  return `${pin.latitude.toFixed(4)},${pin.longitude.toFixed(4)},${pin.caughtAt}`;
}

/** Recompute per-catch NOAA lookups when a row is added to an already-planned day. */
export function plannedSpotTideRefreshKey(
  spots: PlannedTideSpot[],
  journal: PlannedTideJournal = {},
  station?: Pick<PlannedTidePin, "latitude" | "longitude"> | null,
): string {
  return spots
    .map((spot) => {
      const pin = pinForPlannedSpot(spot, journal, station);
      return [
        spot.id,
        spot.sourceCatchId?.trim() ?? "",
        spot.sourceBaitId?.trim() ?? "",
        catchTideLookupKey(pin) ?? "",
      ].join(":");
    })
    .join("|");
}

export function catchTideLookupsForSpots(
  spots: PlannedTideSpot[],
  journal: PlannedTideJournal = {},
  station?: Pick<PlannedTidePin, "latitude" | "longitude"> | null,
): Map<string, PlannedTidePin> {
  const lookups = new Map<string, PlannedTidePin>();
  for (const spot of spots) {
    const pin = pinForPlannedSpot(spot, journal, station);
    const key = catchTideLookupKey(pin);
    if (key && pin) lookups.set(key, pin);
  }
  return lookups;
}

/**
 * Plan-day clock when tide height equals the catch’s logged/sampled height
 * and incoming/outgoing matches the catch. Not nearest High/Low, never a
 * leftover High/Low from another day, and never the opposite flood/ebb
 * just because the same height also crosses there.
 */
export function plannedSpotSameTide(
  snap: TideSnapshot | null | undefined,
  day: string,
  pin: PlannedTidePin | null,
  timeZone?: string,
  catchSnap?: TideSnapshot | null,
): string {
  if (!snap?.applies) return "";
  const zone = timeZone ?? timeZoneFromLongitude(pin?.longitude);
  const extremes = extremesForChip(snap);
  const mapped = planDayReferenceAt(day, pin?.caughtAt);
  const sampled = mapped && extremes.length >= 2 ? heightAndDirectionAt(extremes, mapped) : null;
  if (pin && extremes.length >= 2) {
    const preferAt = pin.caughtAt ? new Date(pin.caughtAt) : null;
    const dayRange = tideHeightRangeForDay(snap, day, zone);
    const sourceRange = catchTideRange(catchSnap, pin, zone);
    const catchHeight = catchLoggedOrSampledHeight(pin, catchSnap);
    const inDayRange = catchHeight != null && dayRange ? heightInRange(catchHeight, dayRange) : false;
    let height = catchHeight;
    let remappedFromOutside = false;
    if (height != null && dayRange && !inDayRange) {
      if (sourceRange) {
        height = remapHeightToRange(height, sourceRange, dayRange);
        remappedFromOutside = true;
      } else {
        height = null;
      }
    }
    if (height == null || !Number.isFinite(height)) {
      height = sampled?.heightFt ?? null;
    }
    const preferDir = catchFloodEbbDirection(pin, catchSnap, extremes, mapped, zone);
    const clock = preferAt && !Number.isNaN(preferAt.getTime()) ? preferAt : mapped;
    if (height != null && Number.isFinite(height)) {
      let matches = sameTideMatches(extremes, height, day, zone);
      if (!matches.length && dayRange) {
        const clamped = Math.min(dayRange.max, Math.max(dayRange.min, height));
        matches = sameTideMatches(extremes, clamped, day, zone);
        remappedFromOutside = remappedFromOutside || !inDayRange;
      }
      // Same height on the opposite flood/ebb is not a matching tide.
      let label = chipFromMatches(matches, preferDir, clock, zone, extremes, !remappedFromOutside);
      if (!label && preferDir) {
        // Same-direction High↔Low crossing only — never the opposite flood/ebb.
        label = chipFromMatches(
          sameDirectionMatches(extremes, height, day, zone, preferDir),
          preferDir,
          clock,
          zone,
          extremes,
        );
      }
      if (label) return label;
    }
    const fallback = mappedClockChip(sampled, mapped, zone, preferDir, extremes);
    if (fallback) return fallback;
    return fallbackChipFromDayTides(snap, day, zone, preferDir);
  }
  const mappedLabel = mappedClockChip(
    sampled,
    mapped,
    zone,
    catchFloodEbbDirection(pin, catchSnap, extremes, mapped, zone),
    extremes,
  );
  if (mappedLabel) return mappedLabel;
  return fallbackChipFromDayTides(snap, day, zone, pin?.tide);
}

/** One same-tide chip per planned row — never copy another fish’s leftover High/Low. */
export function sameTideChipsForSpots(
  spots: PlannedTideSpot[],
  snap: TideSnapshot | null | undefined,
  day: string,
  journal: PlannedTideJournal = {},
  catchSnaps: Record<string, TideSnapshot | null | undefined> = {},
  station?: Pick<PlannedTidePin, "latitude" | "longitude"> | null,
): Record<string, string> {
  const chips: Record<string, string> = {};
  if (!snap?.applies) return chips;
  const ownPins = spots.map((spot) => pinForPlannedSpot(spot, journal, station));
  const stationPin =
    ownPins.find((pin) => pin != null) ??
    (station
      ? {
          latitude: station.latitude,
          longitude: station.longitude,
          habitat: null,
          caughtAt: null,
          tideHeightFt: null,
          tide: null,
        }
      : null);
  const zone = timeZoneFromLongitude(stationPin?.longitude);
  spots.forEach((spot, index) => {
    const pin = ownPins[index] ?? pinForPlannedSpot(spot, journal, stationPin);
    const lookup = catchTideLookupKey(pin);
    const catchSnap = lookup ? catchSnaps[lookup] : undefined;
    const resolved = pin ? applyCatchTideSnapshot(pin, catchSnap) : pin;
    const label =
      plannedSpotSameTide(snap, day, resolved, zone, catchSnap) ||
      fallbackChipFromDayTides(snap, day, zone, resolved?.tide);
    if (label) chips[spot.id] = label;
  });
  return chips;
}
