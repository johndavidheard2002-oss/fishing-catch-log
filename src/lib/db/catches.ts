import { count, desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { catches } from "./schema";
import { seasonFromDate, timeOfDayFromDate } from "../time";
import type {
  CatchInput,
  CatchRecord,
  Season,
  SpeciesSource,
  TimeOfDay,
  WeatherCondition,
} from "../types";

function nowIso(): string {
  return new Date().toISOString();
}

function mapRow(row: typeof catches.$inferSelect): CatchRecord {
  return {
    id: row.id,
    photoPath: row.photoPath,
    species: row.species,
    speciesSuggested: row.speciesSuggested,
    speciesConfidence: row.speciesConfidence,
    speciesSource: row.speciesSource as SpeciesSource,
    latitude: row.latitude,
    longitude: row.longitude,
    placeName: row.placeName,
    temperatureF: row.temperatureF,
    weatherCondition: row.weatherCondition as WeatherCondition | null,
    windSpeedMph: row.windSpeedMph,
    precipitationIn: row.precipitationIn,
    humidity: row.humidity,
    caughtAt: row.caughtAt,
    timeOfDay: row.timeOfDay as TimeOfDay,
    season: row.season as Season,
    notes: row.notes,
    bait: row.bait,
    tide: row.tide,
    waterClarity: row.waterClarity,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function withDerived(input: CatchInput) {
  const caught = new Date(input.caughtAt);
  return {
    timeOfDay: input.timeOfDay ?? timeOfDayFromDate(caught),
    season: input.season ?? seasonFromDate(caught),
  };
}

export function listCatches(): CatchRecord[] {
  const db = getDb();
  return db.select().from(catches).orderBy(desc(catches.caughtAt)).all().map(mapRow);
}

export function getCatch(id: string): CatchRecord | null {
  const db = getDb();
  const row = db.select().from(catches).where(eq(catches.id, id)).get();
  return row ? mapRow(row) : null;
}

export function createCatch(input: CatchInput): CatchRecord {
  const db = getDb();
  const id = crypto.randomUUID();
  const stamp = nowIso();
  const derived = withDerived(input);
  db.insert(catches)
    .values({
      id,
      photoPath: input.photoPath ?? null,
      species: input.species.trim() || "Unknown",
      speciesSuggested: input.speciesSuggested ?? null,
      speciesConfidence: input.speciesConfidence ?? null,
      speciesSource: input.speciesSource ?? "manual",
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      placeName: input.placeName ?? null,
      temperatureF: input.temperatureF ?? null,
      weatherCondition: input.weatherCondition ?? null,
      windSpeedMph: input.windSpeedMph ?? null,
      precipitationIn: input.precipitationIn ?? null,
      humidity: input.humidity ?? null,
      caughtAt: new Date(input.caughtAt).toISOString(),
      timeOfDay: derived.timeOfDay,
      season: derived.season,
      notes: input.notes ?? null,
      bait: input.bait ?? null,
      tide: input.tide ?? null,
      waterClarity: input.waterClarity ?? null,
      createdAt: stamp,
      updatedAt: stamp,
    })
    .run();
  return getCatch(id)!;
}

export function updateCatch(id: string, input: Partial<CatchInput>): CatchRecord | null {
  const existing = getCatch(id);
  if (!existing) return null;
  const db = getDb();
  const caughtAt = input.caughtAt ? new Date(input.caughtAt).toISOString() : existing.caughtAt;
  const derived = withDerived({
    species: input.species ?? existing.species,
    caughtAt,
    timeOfDay: input.timeOfDay,
    season: input.season,
  });
  db.update(catches)
    .set({
      photoPath: input.photoPath === undefined ? existing.photoPath : input.photoPath,
      species: input.species?.trim() || existing.species,
      speciesSuggested:
        input.speciesSuggested === undefined
          ? existing.speciesSuggested
          : input.speciesSuggested,
      speciesConfidence:
        input.speciesConfidence === undefined
          ? existing.speciesConfidence
          : input.speciesConfidence,
      speciesSource: input.speciesSource ?? existing.speciesSource,
      latitude: input.latitude === undefined ? existing.latitude : input.latitude,
      longitude: input.longitude === undefined ? existing.longitude : input.longitude,
      placeName: input.placeName === undefined ? existing.placeName : input.placeName,
      temperatureF:
        input.temperatureF === undefined ? existing.temperatureF : input.temperatureF,
      weatherCondition:
        input.weatherCondition === undefined
          ? existing.weatherCondition
          : input.weatherCondition,
      windSpeedMph:
        input.windSpeedMph === undefined ? existing.windSpeedMph : input.windSpeedMph,
      precipitationIn:
        input.precipitationIn === undefined
          ? existing.precipitationIn
          : input.precipitationIn,
      humidity: input.humidity === undefined ? existing.humidity : input.humidity,
      caughtAt,
      timeOfDay: derived.timeOfDay,
      season: derived.season,
      notes: input.notes === undefined ? existing.notes : input.notes,
      bait: input.bait === undefined ? existing.bait : input.bait,
      tide: input.tide === undefined ? existing.tide : input.tide,
      waterClarity:
        input.waterClarity === undefined ? existing.waterClarity : input.waterClarity,
      updatedAt: nowIso(),
    })
    .where(eq(catches.id, id))
    .run();
  return getCatch(id);
}

export function deleteCatch(id: string): boolean {
  const db = getDb();
  const result = db.delete(catches).where(eq(catches.id, id)).run();
  return result.changes > 0;
}

export function countCatches(): number {
  const db = getDb();
  const row = db.select({ n: count() }).from(catches).get();
  return row?.n ?? 0;
}
