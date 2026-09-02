import { inferHabitat, isHabitat } from "./habitat";
import { isMoonPhase } from "./moon";
import { isPressureTrend } from "./pressure";
import { normalizeCondition } from "./labels";
import { seasonFromDate, timeOfDayFromDate } from "./time";
import type {
  CatchInput,
  Habitat,
  Season,
  SpeciesSource,
  TimeOfDay,
  WeatherCondition,
} from "./types";
import { SEASONS, SPECIES_SOURCES, TIME_OF_DAY, WEATHER_CONDITIONS } from "./types";
import { isWindDirection } from "./wind";

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

function asTime(value: unknown, fallbackDate: Date): TimeOfDay {
  if (typeof value === "string" && TIME_OF_DAY.includes(value as TimeOfDay)) {
    return value as TimeOfDay;
  }
  return timeOfDayFromDate(fallbackDate);
}

function asSeason(value: unknown, fallbackDate: Date): Season {
  if (typeof value === "string" && SEASONS.includes(value as Season)) {
    return value as Season;
  }
  return seasonFromDate(fallbackDate);
}

function asStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const list = value.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean);
    return list.length ? list : null;
  }
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return asStringArray(parsed);
    } catch {
      return null;
    }
  }
  return null;
}

function asSource(value: unknown): SpeciesSource | undefined {
  if (typeof value === "string" && SPECIES_SOURCES.includes(value as SpeciesSource)) {
    return value as SpeciesSource;
  }
  return undefined;
}

function asHabitat(value: unknown, species: string): Habitat {
  if (typeof value === "string" && isHabitat(value)) return value;
  return inferHabitat(species);
}

function asCondition(value: unknown): WeatherCondition | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (WEATHER_CONDITIONS.includes(value as WeatherCondition)) {
    return value as WeatherCondition;
  }
  return normalizeCondition(value);
}

function asWindDirection(value: unknown): string | null {
  const s = asString(value);
  if (!s) return null;
  const upper = s.toUpperCase();
  return isWindDirection(upper) ? upper : s;
}

function asMoonPhase(value: unknown): string | null {
  const s = asString(value);
  if (!s) return null;
  return isMoonPhase(s) ? s : s;
}

function asPressureTrend(value: unknown): string | null {
  const s = asString(value);
  if (!s) return null;
  const lower = s.toLowerCase();
  return isPressureTrend(lower) ? lower : s;
}

export function catchInputFromUnknown(body: Record<string, unknown>): CatchInput {
  const caughtRaw = asString(body.caughtAt) ?? new Date().toISOString();
  const caught = new Date(caughtRaw);
  const caughtAt = Number.isNaN(caught.getTime()) ? new Date() : caught;
  const species = asString(body.species) ?? "Unknown";

  return {
    photoPath: asString(body.photoPath),
    species,
    speciesList: asStringArray(body.speciesList),
    speciesSuggested: asString(body.speciesSuggested),
    speciesConfidence: asNumber(body.speciesConfidence),
    speciesSource: asSource(body.speciesSource),
    latitude: asNumber(body.latitude),
    longitude: asNumber(body.longitude),
    photoTakenLatitude: asNumber(body.photoTakenLatitude),
    photoTakenLongitude: asNumber(body.photoTakenLongitude),
    placeName: asString(body.placeName),
    temperatureF: asNumber(body.temperatureF),
    weatherCondition: asCondition(body.weatherCondition),
    windSpeedMph: asNumber(body.windSpeedMph),
    windDirection: asWindDirection(body.windDirection),
    precipitationIn: asNumber(body.precipitationIn),
    humidity: asNumber(body.humidity),
    moonPhase: asMoonPhase(body.moonPhase),
    moonIllumination: asNumber(body.moonIllumination),
    pressureInHg: asNumber(body.pressureInHg),
    pressureMb: asNumber(body.pressureMb),
    pressureTrend: asPressureTrend(body.pressureTrend),
    caughtAt: caughtAt.toISOString(),
    timeOfDay: asTime(body.timeOfDay, caughtAt),
    season: asSeason(body.season, caughtAt),
    notes: asString(body.notes),
    bait: asString(body.bait),
    tide: asString(body.tide),
    waterClarity: asString(body.waterClarity),
    habitat: asHabitat(body.habitat, species),
    sharedWithLinked: body.sharedWithLinked === true || body.sharedWithLinked === 1,
  };
}

export function photoUrl(photoPath: string | null): string | null {
  if (!photoPath) return null;
  if (photoPath.startsWith("/seed/") || photoPath.startsWith("http")) return photoPath;
  return `/api/media/${encodeURIComponent(photoPath)}`;
}
