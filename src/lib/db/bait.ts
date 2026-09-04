import { desc, eq } from "drizzle-orm";
import { rememberNamedArea } from "./areas";
import { getAngler, linkedBuddyIds } from "./anglers";
import { ensureDb } from "./index";
import { allRows, getRow, runChange } from "./query";
import { baitSpots } from "./schema";
import { parseBaitTypes, parseBaitTypesJson } from "../bait";
import { DEFAULT_HABITAT, isHabitat } from "../habitat";
import { moonForDate } from "../moon";
import { isCatchVisibleToViewer } from "../sharing";
import { seasonFromCaughtAtInput, seasonFromDate, timeOfDayFromCaughtAtInput, timeOfDayFromDate } from "../time";
import type { BaitSpot, BaitSpotInput, Habitat, Season, TimeOfDay, WeatherCondition } from "../types";

function nowIso(): string {
  return new Date().toISOString();
}

function asHabitat(value: string | null | undefined): Habitat {
  if (value && isHabitat(value) && value !== "freshwater" && value !== "duck") return value;
  return DEFAULT_HABITAT;
}

function mapRow(
  row: typeof baitSpots.$inferSelect,
  ownerNameById: Map<string, string>,
): BaitSpot {
  const anglerId = row.anglerId;
  return {
    id: row.id,
    photoPath: row.photoPath,
    placeName: row.placeName,
    baitTypes: parseBaitTypesJson(row.baitTypes),
    latitude: row.latitude,
    longitude: row.longitude,
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
    loggedAt: row.loggedAt,
    timeOfDay: row.timeOfDay as TimeOfDay,
    season: row.season as Season,
    notes: row.notes,
    tide: row.tide,
    tideHeightFt: row.tideHeightFt,
    tideDetail: row.tideDetail,
    habitat: asHabitat(row.habitat),
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

function withDerived(input: BaitSpotInput) {
  const logged = new Date(input.loggedAt);
  const moon = Number.isNaN(logged.getTime()) ? null : moonForDate(logged);
  return {
    timeOfDay: input.timeOfDay ?? timeOfDayFromCaughtAtInput(input.loggedAt) ?? timeOfDayFromDate(logged),
    season: input.season ?? seasonFromCaughtAtInput(input.loggedAt) ?? seasonFromDate(logged),
    moonPhase: input.moonPhase ?? moon?.phase ?? null,
    moonIllumination: input.moonIllumination ?? moon?.illumination ?? null,
  };
}

export type ListBaitOptions = {
  viewerId?: string;
  includeShared?: boolean;
};

export async function listBaitSpots(opts: ListBaitOptions = {}): Promise<BaitSpot[]> {
  const db = await ensureDb();
  const rows = await allRows(db.select().from(baitSpots).orderBy(desc(baitSpots.loggedAt)));
  const names = await ownerNames(rows.map((r) => r.anglerId));
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

export async function getBaitSpot(id: string): Promise<BaitSpot | null> {
  const db = await ensureDb();
  const row = await getRow(db.select().from(baitSpots).where(eq(baitSpots.id, id)));
  if (!row) return null;
  return mapRow(row, await ownerNames([row.anglerId]));
}

export async function canViewBaitSpot(record: BaitSpot, viewerId: string): Promise<boolean> {
  return isCatchVisibleToViewer({
    anglerId: record.anglerId,
    sharedWithLinked: record.sharedWithLinked,
    viewerId,
    includeShared: true,
    linkedBuddyIds: await linkedBuddyIds(viewerId),
  });
}

export async function createBaitSpot(input: BaitSpotInput): Promise<BaitSpot> {
  const db = await ensureDb();
  const id = crypto.randomUUID();
  const stamp = nowIso();
  const derived = withDerived(input);
  const baitTypes = parseBaitTypes(input.baitTypes);
  const habitat = asHabitat(input.habitat);
  const anglerId = input.anglerId ?? null;
  if (!anglerId) throw new Error("Angler is required");
  await runChange(
    db.insert(baitSpots).values({
      id,
      photoPath: input.photoPath ?? null,
      placeName: input.placeName ?? null,
      baitTypes: JSON.stringify(baitTypes),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
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
      loggedAt: new Date(input.loggedAt).toISOString(),
      timeOfDay: derived.timeOfDay,
      season: derived.season,
      notes: input.notes ?? null,
      tide: input.tide ?? null,
      tideHeightFt: input.tideHeightFt ?? null,
      tideDetail: input.tideDetail ?? null,
      habitat,
      anglerId,
      sharedWithLinked: input.sharedWithLinked ? 1 : 0,
      createdAt: stamp,
      updatedAt: stamp,
    }),
  );
  await rememberNamedArea(anglerId, input.placeName, input.latitude, input.longitude);
  return (await getBaitSpot(id))!;
}

export async function updateBaitSpot(id: string, input: Partial<BaitSpotInput>): Promise<BaitSpot | null> {
  const existing = await getBaitSpot(id);
  if (!existing) return null;
  const db = await ensureDb();
  const loggedAt = input.loggedAt ? new Date(input.loggedAt).toISOString() : existing.loggedAt;
  const baitTypes =
    input.baitTypes !== undefined ? parseBaitTypes(input.baitTypes) : existing.baitTypes;
  const derived = withDerived({
    baitTypes,
    loggedAt,
    timeOfDay: input.timeOfDay,
    season: input.season,
    moonPhase: input.moonPhase === undefined ? existing.moonPhase : input.moonPhase,
    moonIllumination:
      input.moonIllumination === undefined ? existing.moonIllumination : input.moonIllumination,
  });
  const habitat = input.habitat === undefined ? existing.habitat : asHabitat(input.habitat);
  const anglerId = input.anglerId === undefined ? existing.anglerId : input.anglerId;
  if (!anglerId) return null;
  const placeName = input.placeName === undefined ? existing.placeName : input.placeName;
  const latitude = input.latitude === undefined ? existing.latitude : input.latitude;
  const longitude = input.longitude === undefined ? existing.longitude : input.longitude;
  await runChange(
    db.update(baitSpots)
    .set({
      photoPath: input.photoPath === undefined ? existing.photoPath : input.photoPath,
      placeName,
      baitTypes: JSON.stringify(baitTypes),
      latitude,
      longitude,
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
      pressureMb: input.pressureMb === undefined ? existing.pressureMb : input.pressureMb,
      pressureTrend:
        input.pressureTrend === undefined ? existing.pressureTrend : input.pressureTrend,
      loggedAt,
      timeOfDay: derived.timeOfDay,
      season: derived.season,
      notes: input.notes === undefined ? existing.notes : input.notes,
      tide: input.tide === undefined ? existing.tide : input.tide,
      tideHeightFt:
        input.tideHeightFt === undefined ? existing.tideHeightFt : input.tideHeightFt,
      tideDetail: input.tideDetail === undefined ? existing.tideDetail : input.tideDetail,
      habitat,
      anglerId,
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
    .where(eq(baitSpots.id, id)),
  );
  await rememberNamedArea(anglerId, placeName, latitude, longitude);
  return getBaitSpot(id);
}

/** Flip share without re-parsing bait types or map fields. */
export async function setBaitSpotShared(id: string, shared: boolean): Promise<BaitSpot | null> {
  const existing = await getBaitSpot(id);
  if (!existing) return null;
  const db = await ensureDb();
  await runChange(
    db
      .update(baitSpots)
      .set({
        sharedWithLinked: shared ? 1 : 0,
        updatedAt: nowIso(),
      })
      .where(eq(baitSpots.id, id)),
  );
  return getBaitSpot(id);
}

export async function setSharedForBaitIds(args: {
  anglerId: string;
  ids: string[];
  shared: boolean;
}): Promise<{ updated: number }> {
  const unique = [...new Set(args.ids.filter(Boolean))];
  let updated = 0;
  for (const id of unique) {
    const record = await getBaitSpot(id);
    if (!record || record.anglerId !== args.anglerId) continue;
    await setBaitSpotShared(id, args.shared);
    updated += 1;
  }
  return { updated };
}

export async function deleteBaitSpot(id: string): Promise<boolean> {
  const db = await ensureDb();
  const changes = await runChange(db.delete(baitSpots).where(eq(baitSpots.id, id)));
  return changes > 0;
}
