import { haversineKm } from "./similar";
import { SAME_SPOT_KM } from "./filters";
import type {
  BaitSpot,
  BaitSpotGroup,
  BaitSpotInput,
  Habitat,
  Season,
  TimeOfDay,
  WeatherCondition,
} from "./types";
import { parseAreaName } from "./areas";
import { DEFAULT_HABITAT, isHabitat } from "./habitat";
import { isMoonPhase } from "./moon";
import { isPressureTrend } from "./pressure";
import { normalizeCondition } from "./labels";
import {
  SEASONS,
  TIME_OF_DAY,
  WEATHER_CONDITIONS,
} from "./types";
import { seasonFromCaughtAtInput, seasonFromDate, timeOfDayFromCaughtAtInput, timeOfDayFromDate } from "./time";
import { isWindDirection } from "./wind";

export const BAIT_CATALOG = [
  "Shrimp",
  "Finger mullet",
  "Shad",
  "Croaker",
  "Piggy perch",
  "Pinfish",
  "Crabs",
  "Sand fleas",
  "Squid",
  "Cut bait",
] as const;

const MAX_BAIT_TYPES = 8;
const MAX_BAIT_NAME = 40;
const MAX_NOTES = 2000;

export function parseBaitTypes(value: unknown): string[] {
  let raw: unknown[] = [];
  if (Array.isArray(value)) raw = value;
  else if (typeof value === "string" && value.trim()) {
    if (value.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) raw = parsed;
      } catch {
        raw = value.split(",");
      }
    } else {
      raw = value.split(",");
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const name = item.trim().replace(/\s+/g, " ").slice(0, MAX_BAIT_NAME);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_BAIT_TYPES) break;
  }
  return out;
}

export function parseBaitTypesJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    return parseBaitTypes(JSON.parse(raw) as unknown);
  } catch {
    return parseBaitTypes(raw);
  }
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asCondition(value: unknown): WeatherCondition | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (WEATHER_CONDITIONS.includes(value as WeatherCondition)) {
    return value as WeatherCondition;
  }
  return normalizeCondition(value);
}

function asTime(value: unknown, fallbackDate: Date, raw: string): TimeOfDay {
  if (typeof value === "string" && TIME_OF_DAY.includes(value as TimeOfDay)) {
    return value as TimeOfDay;
  }
  return timeOfDayFromCaughtAtInput(raw) ?? timeOfDayFromDate(fallbackDate);
}

function asSeason(value: unknown, fallbackDate: Date, raw: string): Season {
  if (typeof value === "string" && SEASONS.includes(value as Season)) {
    return value as Season;
  }
  return seasonFromCaughtAtInput(raw) ?? seasonFromDate(fallbackDate);
}

function asHabitat(value: unknown): Habitat {
  if (typeof value === "string" && isHabitat(value) && value !== "freshwater") return value;
  return DEFAULT_HABITAT;
}

export function baitSpotHasContent(input: {
  baitTypes?: string[] | null;
  placeName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  photoPath?: string | null;
}): boolean {
  return Boolean(
    (input.baitTypes && input.baitTypes.length) ||
      input.placeName?.trim() ||
      (input.latitude != null && input.longitude != null) ||
      input.notes?.trim() ||
      input.photoPath,
  );
}

export function parseBaitSpotInput(body: Record<string, unknown>): BaitSpotInput | null {
  const loggedRaw = asString(body.loggedAt) ?? new Date().toISOString();
  const parsed = new Date(loggedRaw);
  const loggedAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const baitTypes = parseBaitTypes(body.baitTypes);
  const placeName = parseAreaName(body.placeName);
  const latitude = asNumber(body.latitude);
  const longitude = asNumber(body.longitude);
  const notes = asString(body.notes)?.slice(0, MAX_NOTES) ?? null;
  const input: BaitSpotInput = {
    photoPath: asString(body.photoPath),
    placeName,
    baitTypes,
    latitude,
    longitude,
    temperatureF: asNumber(body.temperatureF),
    weatherCondition: asCondition(body.weatherCondition),
    windSpeedMph: asNumber(body.windSpeedMph),
    windDirection: (() => {
      const s = asString(body.windDirection);
      if (!s) return null;
      const upper = s.toUpperCase();
      return isWindDirection(upper) ? upper : s;
    })(),
    precipitationIn: asNumber(body.precipitationIn),
    humidity: asNumber(body.humidity),
    moonPhase: (() => {
      const s = asString(body.moonPhase);
      if (!s) return null;
      return isMoonPhase(s) ? s : s;
    })(),
    moonIllumination: asNumber(body.moonIllumination),
    pressureInHg: asNumber(body.pressureInHg),
    pressureMb: asNumber(body.pressureMb),
    pressureTrend: (() => {
      const s = asString(body.pressureTrend);
      if (!s) return null;
      const lower = s.toLowerCase();
      return isPressureTrend(lower) ? lower : s;
    })(),
    loggedAt: loggedAt.toISOString(),
    timeOfDay: asTime(body.timeOfDay, loggedAt, loggedRaw),
    season: asSeason(body.season, loggedAt, loggedRaw),
    notes,
    tide: asString(body.tide),
    tideHeightFt: asNumber(body.tideHeightFt),
    tideDetail: asString(body.tideDetail),
    habitat: asHabitat(body.habitat),
    sharedWithLinked: body.sharedWithLinked === true || body.sharedWithLinked === 1,
  };
  if (!baitTypes.length) return null;
  if (latitude == null || longitude == null) return null;
  if (!baitSpotHasContent(input)) return null;
  return input;
}

function mostCommon<T extends string>(values: T[]): T | null {
  if (!values.length) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function placeNameKey(spot: BaitSpot): string | null {
  const name = spot.placeName?.trim();
  if (!name) return null;
  return name.toLowerCase().replace(/\s+/g, " ");
}

function clusterCenter(cluster: BaitSpot[]): { lat: number; lon: number } | null {
  const withCoords = cluster.filter((c) => c.latitude != null && c.longitude != null);
  if (!withCoords.length) return null;
  return {
    lat: withCoords.reduce((s, c) => s + (c.latitude ?? 0), 0) / withCoords.length,
    lon: withCoords.reduce((s, c) => s + (c.longitude ?? 0), 0) / withCoords.length,
  };
}

function belongsToCluster(cluster: BaitSpot[], spot: BaitSpot): boolean {
  const center = clusterCenter(cluster);
  if (spot.latitude != null && spot.longitude != null && center) {
    return haversineKm(center.lat, center.lon, spot.latitude, spot.longitude) <= SAME_SPOT_KM;
  }
  const a = placeNameKey(cluster[0]);
  const b = placeNameKey(spot);
  return Boolean(a && b && a === b);
}

export function baitSpotKey(spot: BaitSpot): string {
  if (spot.latitude != null && spot.longitude != null) {
    return `bait:${spot.latitude.toFixed(3)},${spot.longitude.toFixed(3)}`;
  }
  if (spot.placeName?.trim()) {
    return `bait:${spot.placeName.trim().toLowerCase().replace(/\s+/g, " ")}`;
  }
  return `bait:${spot.id}`;
}

export function groupBaitSpots(records: BaitSpot[]): BaitSpotGroup[] {
  const clusters: BaitSpot[][] = [];
  for (const record of records) {
    const hit = clusters.find((cluster) => belongsToCluster(cluster, record));
    if (hit) hit.push(record);
    else clusters.push([record]);
  }

  return clusters
    .map((spots) => {
      const center = clusterCenter(spots);
      const named = spots.find((c) => c.placeName)?.placeName;
      const key = center
        ? `bait:${center.lat.toFixed(3)},${center.lon.toFixed(3)}`
        : baitSpotKey(spots[0]);
      const baitTypes = [...new Set(spots.flatMap((s) => s.baitTypes))];
      return {
        key,
        placeName: named ?? key.replace(/^bait:/, ""),
        latitude: center?.lat ?? null,
        longitude: center?.lon ?? null,
        visitCount: spots.length,
        baitTypes,
        lastLoggedAt: [...spots].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0].loggedAt,
        typicalCondition: mostCommon(
          spots
            .map((c) => c.weatherCondition)
            .filter((v): v is NonNullable<typeof v> => v != null),
        ),
        typicalTime: mostCommon(spots.map((c) => c.timeOfDay)),
        avgTempF: (() => {
          const temps = spots.map((c) => c.temperatureF).filter((n): n is number => n != null);
          return temps.length ? Math.round(temps.reduce((s, n) => s + n, 0) / temps.length) : null;
        })(),
        spots: [...spots].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)),
      };
    })
    .sort((a, b) => b.visitCount - a.visitCount);
}

export function baitTypesLabel(types: string[]): string {
  if (!types.length) return "Bait";
  if (types.length === 1) return types[0];
  if (types.length === 2) return types.join(" + ");
  return `${types.slice(0, 2).join(", ")} +${types.length - 2}`;
}
