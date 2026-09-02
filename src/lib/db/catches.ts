import { count, desc, eq } from "drizzle-orm";
import { inferHabitat, isHabitat } from "../habitat";
import { moonForDate } from "../moon";
import { clampFishCount } from "../count";
import { normalizeSpeciesList, parseSpeciesListJson, primarySpecies } from "../species";
import { seasonFromCaughtAtInput, seasonFromDate, timeOfDayFromCaughtAtInput, timeOfDayFromDate } from "../time";
import type {
  CatchInput,
  CatchRecord,
  Habitat,
  Season,
  SpeciesSource,
  TimeOfDay,
  WeatherCondition,
} from "../types";
import { isCatchVisibleToViewer } from "../sharing";
import { getAngler, linkedBuddyIds } from "./anglers";
import { getDb } from "./index";
import { catches } from "./schema";

function nowIso(): string {
  return new Date().toISOString();
}

function asHabitat(value: string | null | undefined, species: string): Habitat {
  if (value && isHabitat(value)) return value;
  return inferHabitat(species);
}

function mapRow(
  row: typeof catches.$inferSelect,
  ownerNameById: Map<string, string>,
): CatchRecord {
  const speciesList = normalizeSpeciesList(
    row.species,
    parseSpeciesListJson(row.speciesList),
  );
  const species = primarySpecies(speciesList);
  const anglerId = row.anglerId || "unknown";
  return {
    id: row.id,
    photoPath: row.photoPath,
    species,
    speciesList: speciesList.length ? speciesList : [species],
    speciesSuggested: row.speciesSuggested,
    speciesConfidence: row.speciesConfidence,
    speciesSource: row.speciesSource as SpeciesSource,
    latitude: row.latitude,
    longitude: row.longitude,
    photoTakenLatitude: row.photoTakenLatitude,
    photoTakenLongitude: row.photoTakenLongitude,
    placeName: row.placeName,
    temperatureF: row.temperatureF,
    weatherCondition: row.weatherCondition as WeatherCondition | null,
    windSpeedMph: row.windSpeedMph,
    windDirection: row.windDirection,
    precipitationIn: row.precipitationIn,
    humidity: row.humidity,
    moonPhase: row.moonPhase,
    moonIllumination: row.moonIllumination,
    pressureInHg: row.pressureInHg,
    pressureMb: row.pressureMb,
    pressureTrend: row.pressureTrend,
    caughtAt: row.caughtAt,
    timeOfDay: row.timeOfDay as TimeOfDay,
    season: row.season as Season,
    notes: row.notes,
    bait: row.bait,
    tide: row.tide,
    tideHeightFt: row.tideHeightFt,
    tideDetail: row.tideDetail,
    waterClarity: row.waterClarity,
    habitat: asHabitat(row.habitat, species),
    fishCount: clampFishCount(row.fishCount, speciesList.length || 1),
    anglerId,
    sharedWithLinked: Boolean(row.sharedWithLinked),
    ownerName: ownerNameById.get(anglerId) ?? "Angler",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function ownerNames(ids: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const id of new Set(ids)) {
    const angler = getAngler(id);
    if (angler) map.set(id, angler.name);
  }
  return map;
}

function withDerived(input: CatchInput) {
  const caught = new Date(input.caughtAt);
  const moon = Number.isNaN(caught.getTime()) ? null : moonForDate(caught);
  return {
    timeOfDay: input.timeOfDay ?? timeOfDayFromCaughtAtInput(input.caughtAt) ?? timeOfDayFromDate(caught),
    season: input.season ?? seasonFromCaughtAtInput(input.caughtAt) ?? seasonFromDate(caught),
    moonPhase: input.moonPhase ?? moon?.phase ?? null,
    moonIllumination: input.moonIllumination ?? moon?.illumination ?? null,
  };
}

export type ListCatchOptions = {
  viewerId?: string;
  includeShared?: boolean;
};

export function listCatches(opts: ListCatchOptions = {}): CatchRecord[] {
  const db = getDb();
  const rows = db.select().from(catches).orderBy(desc(catches.caughtAt)).all();
  const names = ownerNames(rows.map((r) => r.anglerId || ""));
  const records = rows.map((row) => mapRow(row, names));
  if (!opts.viewerId) return records;
  const buddyIds = opts.includeShared ? linkedBuddyIds(opts.viewerId) : [];
  return records.filter((record) =>
    isCatchVisibleToViewer({
      anglerId: record.anglerId,
      sharedWithLinked: record.sharedWithLinked,
      viewerId: opts.viewerId!,
      includeShared: Boolean(opts.includeShared),
      linkedBuddyIds: buddyIds,
    }),
  );
}

export function getCatch(id: string): CatchRecord | null {
  const db = getDb();
  const row = db.select().from(catches).where(eq(catches.id, id)).get();
  if (!row) return null;
  return mapRow(row, ownerNames([row.anglerId || ""]));
}

export function canViewCatch(record: CatchRecord, viewerId: string): boolean {
  return isCatchVisibleToViewer({
    anglerId: record.anglerId,
    sharedWithLinked: record.sharedWithLinked,
    viewerId,
    includeShared: true,
    linkedBuddyIds: linkedBuddyIds(viewerId),
  });
}

export function createCatch(input: CatchInput): CatchRecord {
  const db = getDb();
  const id = crypto.randomUUID();
  const stamp = nowIso();
  const derived = withDerived(input);
  const speciesList = normalizeSpeciesList(input.species, input.speciesList);
  const species = primarySpecies(speciesList);
  const habitat = asHabitat(input.habitat, species);
  const fishCount = clampFishCount(input.fishCount, speciesList.length || 1);
  db.insert(catches)
    .values({
      id,
      photoPath: input.photoPath ?? null,
      species,
      speciesList: JSON.stringify(speciesList.length ? speciesList : [species]),
      speciesSuggested: input.speciesSuggested ?? null,
      speciesConfidence: input.speciesConfidence ?? null,
      speciesSource: input.speciesSource ?? "manual",
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      photoTakenLatitude: input.photoTakenLatitude ?? null,
      photoTakenLongitude: input.photoTakenLongitude ?? null,
      placeName: input.placeName ?? null,
      temperatureF: input.temperatureF ?? null,
      weatherCondition: input.weatherCondition ?? null,
      windSpeedMph: input.windSpeedMph ?? null,
      windDirection: input.windDirection ?? null,
      precipitationIn: input.precipitationIn ?? null,
      humidity: input.humidity ?? null,
      moonPhase: derived.moonPhase,
      moonIllumination: derived.moonIllumination,
      pressureInHg: input.pressureInHg ?? null,
      pressureMb: input.pressureMb ?? null,
      pressureTrend: input.pressureTrend ?? null,
      caughtAt: new Date(input.caughtAt).toISOString(),
      timeOfDay: derived.timeOfDay,
      season: derived.season,
      notes: input.notes ?? null,
      bait: input.bait ?? null,
      tide: input.tide ?? null,
      tideHeightFt: input.tideHeightFt ?? null,
      tideDetail: input.tideDetail ?? null,
      waterClarity: input.waterClarity ?? null,
      habitat,
      fishCount,
      anglerId: input.anglerId ?? null,
      sharedWithLinked: input.sharedWithLinked ? 1 : 0,
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
  const speciesList =
    input.speciesList !== undefined || input.species !== undefined
      ? normalizeSpeciesList(
          input.species ?? existing.species,
          input.speciesList === undefined ? existing.speciesList : input.speciesList,
        )
      : existing.speciesList;
  const species = primarySpecies(speciesList);
  const derived = withDerived({
    species,
    caughtAt,
    timeOfDay: input.timeOfDay,
    season: input.season,
    moonPhase: input.moonPhase === undefined ? existing.moonPhase : input.moonPhase,
    moonIllumination:
      input.moonIllumination === undefined
        ? existing.moonIllumination
        : input.moonIllumination,
  });
  const habitat =
    input.habitat === undefined ? existing.habitat : asHabitat(input.habitat, species);
  const fishCount =
    input.fishCount === undefined
      ? clampFishCount(existing.fishCount, speciesList.length || 1)
      : clampFishCount(input.fishCount, speciesList.length || 1);
  db.update(catches)
    .set({
      photoPath: input.photoPath === undefined ? existing.photoPath : input.photoPath,
      species,
      speciesList: JSON.stringify(speciesList.length ? speciesList : [species]),
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
      photoTakenLatitude:
        input.photoTakenLatitude === undefined
          ? existing.photoTakenLatitude
          : input.photoTakenLatitude,
      photoTakenLongitude:
        input.photoTakenLongitude === undefined
          ? existing.photoTakenLongitude
          : input.photoTakenLongitude,
      placeName: input.placeName === undefined ? existing.placeName : input.placeName,
      temperatureF:
        input.temperatureF === undefined ? existing.temperatureF : input.temperatureF,
      weatherCondition:
        input.weatherCondition === undefined
          ? existing.weatherCondition
          : input.weatherCondition,
      windSpeedMph:
        input.windSpeedMph === undefined ? existing.windSpeedMph : input.windSpeedMph,
      windDirection:
        input.windDirection === undefined ? existing.windDirection : input.windDirection,
      precipitationIn:
        input.precipitationIn === undefined
          ? existing.precipitationIn
          : input.precipitationIn,
      humidity: input.humidity === undefined ? existing.humidity : input.humidity,
      moonPhase: derived.moonPhase,
      moonIllumination: derived.moonIllumination,
      pressureInHg:
        input.pressureInHg === undefined ? existing.pressureInHg : input.pressureInHg,
      pressureMb:
        input.pressureMb === undefined ? existing.pressureMb : input.pressureMb,
      pressureTrend:
        input.pressureTrend === undefined ? existing.pressureTrend : input.pressureTrend,
      caughtAt,
      timeOfDay: derived.timeOfDay,
      season: derived.season,
      notes: input.notes === undefined ? existing.notes : input.notes,
      bait: input.bait === undefined ? existing.bait : input.bait,
      tide: input.tide === undefined ? existing.tide : input.tide,
      tideHeightFt:
        input.tideHeightFt === undefined ? existing.tideHeightFt : input.tideHeightFt,
      tideDetail: input.tideDetail === undefined ? existing.tideDetail : input.tideDetail,
      waterClarity:
        input.waterClarity === undefined ? existing.waterClarity : input.waterClarity,
      habitat,
      fishCount,
      anglerId: input.anglerId === undefined ? existing.anglerId : input.anglerId,
      sharedWithLinked:
        input.sharedWithLinked === undefined
          ? existing.sharedWithLinked
            ? 1
            : 0
          : input.sharedWithLinked
            ? 1
            : 0,
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
