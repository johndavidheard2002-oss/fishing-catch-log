import { inferHabitat, isHabitat } from "./habitat";
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

export function catchInputFromUnknown(body: Record<string, unknown>): CatchInput {
  const caughtRaw = asString(body.caughtAt) ?? new Date().toISOString();
  const caught = new Date(caughtRaw);
  const caughtAt = Number.isNaN(caught.getTime()) ? new Date() : caught;
  const species = asString(body.species) ?? "Unknown";

  return {
    photoPath: asString(body.photoPath),
    species,
    speciesSuggested: asString(body.speciesSuggested),
    speciesConfidence: asNumber(body.speciesConfidence),
    speciesSource: asSource(body.speciesSource),
    latitude: asNumber(body.latitude),
    longitude: asNumber(body.longitude),
    placeName: asString(body.placeName),
    temperatureF: asNumber(body.temperatureF),
    weatherCondition: asCondition(body.weatherCondition),
    windSpeedMph: asNumber(body.windSpeedMph),
    precipitationIn: asNumber(body.precipitationIn),
    humidity: asNumber(body.humidity),
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
