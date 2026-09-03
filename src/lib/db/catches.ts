import { desc, eq } from "drizzle-orm";
import { inferHabitat, isHabitat } from "../habitat";
import { moonForDate } from "../moon";
import {
  clampFishCount,
  countsForCatch,
  parseSpeciesCountsJson,
  resolveCatchCounts,
} from "../count";
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
import { localDateKey } from "../calendar";
import { rememberNamedArea } from "./areas";
import { getAngler, linkedBuddyIds } from "./anglers";
import { listBaitSpots, setSharedForBaitIds } from "./bait";
import { ensureDb } from "./index";
import { allRows, getRow, runChange } from "./query";
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
    fishCount: clampFishCount(row.fishCount),
    speciesCounts: countsForCatch({
      species,
      speciesList: speciesList.length ? speciesList : [species],
      fishCount: row.fishCount,
      speciesCounts: parseSpeciesCountsJson(row.speciesCounts) ?? [],
    }),
    anglerId,
    sharedWithLinked: Boolean(row.sharedWithLinked),
    ownerName: ownerNameById.get(anglerId) ?? "Angler",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function ownerNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const id of new Set(ids)) {
    const angler = await getAngler(id);
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

export async function listCatches(opts: ListCatchOptions = {}): Promise<CatchRecord[]> {
  const db = await ensureDb();
  const rows = await allRows(db.select().from(catches).orderBy(desc(catches.caughtAt)));
  const names = await ownerNames(rows.map((r) => r.anglerId || ""));
  const records = rows.map((row) => mapRow(row, names));
  if (!opts.viewerId) return records;
  const buddyIds = opts.includeShared ? await linkedBuddyIds(opts.viewerId) : [];
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

export async function getCatch(id: string): Promise<CatchRecord | null> {
  const db = await ensureDb();
  const row = await getRow(db.select().from(catches).where(eq(catches.id, id)));
  if (!row) return null;
  return mapRow(row, await ownerNames([row.anglerId || ""]));
}

export async function canViewCatch(record: CatchRecord, viewerId: string): Promise<boolean> {
  return isCatchVisibleToViewer({
    anglerId: record.anglerId,
    sharedWithLinked: record.sharedWithLinked,
    viewerId,
    includeShared: true,
    linkedBuddyIds: await linkedBuddyIds(viewerId),
  });
}

export async function createCatch(input: CatchInput): Promise<CatchRecord> {
  const db = await ensureDb();
  const id = crypto.randomUUID();
  const stamp = nowIso();
  const derived = withDerived(input);
  const speciesList = normalizeSpeciesList(input.species, input.speciesList);
  const species = primarySpecies(speciesList);
  const habitat = asHabitat(input.habitat, species);
  const resolved = resolveCatchCounts(
    speciesList.length ? speciesList : [species],
    input.speciesCounts,
    input.fishCount,
  );
  const speciesCounts = resolved.speciesCounts;
  const fishCount = resolved.fishCount;
  await runChange(
    db.insert(catches).values({
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
      speciesCounts: JSON.stringify(speciesCounts),
      anglerId: input.anglerId ?? null,
      sharedWithLinked: input.sharedWithLinked ? 1 : 0,
      createdAt: stamp,
      updatedAt: stamp,
    }),
  );
  await rememberNamedArea(input.anglerId, input.placeName, input.latitude, input.longitude);
  return (await getCatch(id))!;
}

export async function updateCatch(id: string, input: Partial<CatchInput>): Promise<CatchRecord | null> {
  const existing = await getCatch(id);
  if (!existing) return null;
  const db = await ensureDb();
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
  const resolved = resolveCatchCounts(
    speciesList.length ? speciesList : [species],
    input.speciesCounts === undefined ? existing.speciesCounts : input.speciesCounts,
    input.fishCount === undefined ? existing.fishCount : input.fishCount,
  );
  const speciesCounts = resolved.speciesCounts;
  const fishCount = resolved.fishCount;
  await runChange(
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
      speciesCounts: JSON.stringify(speciesCounts),
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
    .where(eq(catches.id, id)),
  );
  const saved = await getCatch(id);
  if (saved) {
    await rememberNamedArea(saved.anglerId, saved.placeName, saved.latitude, saved.longitude);
  }
  return saved;
}

export async function deleteCatch(id: string): Promise<boolean> {
  const db = await ensureDb();
  const changes = await runChange(db.delete(catches).where(eq(catches.id, id)));
  return changes > 0;
}

const CALENDAR_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDayKey(value: string): boolean {
  return CALENDAR_DAY_RE.test(value);
}

/** Share or unshare only the viewer’s own catches. */
export async function setSharedForCatchIds(args: {
  anglerId: string;
  ids: string[];
  shared: boolean;
}): Promise<{ updated: number }> {
  const unique = [...new Set(args.ids.filter(Boolean))];
  let updated = 0;
  for (const id of unique) {
    const record = await getCatch(id);
    if (!record || record.anglerId !== args.anglerId) continue;
    await updateCatch(id, { sharedWithLinked: args.shared });
    updated += 1;
  }
  return { updated };
}

/** Share or unshare every catch and bait hole the angler logged on a local calendar day. */
export async function setSharedForDay(args: {
  anglerId: string;
  day: string;
  shared: boolean;
}): Promise<{ updated: number }> {
  if (!isCalendarDayKey(args.day)) return { updated: 0 };
  const mine = (await listCatches({ viewerId: args.anglerId })).filter(
    (record) => record.anglerId === args.anglerId && localDateKey(record.caughtAt) === args.day,
  );
  const catchIds = mine.map((record) => record.id);
  const mineBait = (await listBaitSpots({ viewerId: args.anglerId })).filter(
    (spot) => spot.anglerId === args.anglerId && localDateKey(spot.loggedAt) === args.day,
  );
  const catches = await setSharedForCatchIds({
    anglerId: args.anglerId,
    ids: catchIds,
    shared: args.shared,
  });
  const bait = await setSharedForBaitIds({
    anglerId: args.anglerId,
    ids: mineBait.map((spot) => spot.id),
    shared: args.shared,
  });
  return { updated: catches.updated + bait.updated };
}
