import { and, desc, eq } from "drizzle-orm";
import { areaNameKey, mergeNamedAreas, parseAreaName } from "../areas";
import type { NamedArea, NamedAreaInput } from "../types";
import { ensureDb } from "./index";
import { allRows, getRow, runChange } from "./query";
import { baitSpots, catches, namedAreas } from "./schema";

function nowIso(): string {
  return new Date().toISOString();
}

function mapRow(row: typeof namedAreas.$inferSelect): NamedArea {
  return {
    id: row.id,
    anglerId: row.anglerId,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    source: "saved",
    updatedAt: row.updatedAt,
  };
}

function uniqueInferred(
  rows: { placeName: string | null; latitude: number | null; longitude: number | null; stamp: string }[],
  anglerId: string,
  source: NamedArea["source"],
): NamedArea[] {
  const byKey = new Map<string, NamedArea>();
  for (const row of rows) {
    const name = parseAreaName(row.placeName);
    if (!name) continue;
    const key = areaNameKey(name);
    if (byKey.has(key)) continue;
    byKey.set(key, {
      id: null,
      anglerId,
      name,
      latitude: row.latitude,
      longitude: row.longitude,
      source,
      updatedAt: row.stamp,
    });
  }
  return [...byKey.values()];
}

export async function listSavedNamedAreas(anglerId: string): Promise<NamedArea[]> {
  const db = await ensureDb();
  const rows = await allRows(
    db
      .select()
      .from(namedAreas)
      .where(eq(namedAreas.anglerId, anglerId))
      .orderBy(desc(namedAreas.updatedAt)),
  );
  return rows.map(mapRow);
}

export async function listNamedAreas(anglerId: string): Promise<NamedArea[]> {
  const db = await ensureDb();
  const catchRows = (await allRows(
    db.select().from(catches).where(eq(catches.anglerId, anglerId)).orderBy(desc(catches.caughtAt)),
  )).map((row) => ({
    placeName: row.placeName,
    latitude: row.latitude,
    longitude: row.longitude,
    stamp: row.caughtAt,
  }));
  const baitRows = (await allRows(
    db.select().from(baitSpots).where(eq(baitSpots.anglerId, anglerId)).orderBy(desc(baitSpots.loggedAt)),
  )).map((row) => ({
    placeName: row.placeName,
    latitude: row.latitude,
    longitude: row.longitude,
    stamp: row.loggedAt,
  }));
  const fromCatches = uniqueInferred(catchRows, anglerId, "catch");
  const fromBait = uniqueInferred(baitRows, anglerId, "bait");
  return mergeNamedAreas(await listSavedNamedAreas(anglerId), [...fromCatches, ...fromBait]);
}

export async function getNamedArea(id: string): Promise<NamedArea | null> {
  const db = await ensureDb();
  const row = await getRow(db.select().from(namedAreas).where(eq(namedAreas.id, id)));
  return row ? mapRow(row) : null;
}

export async function upsertNamedArea(anglerId: string, input: NamedAreaInput): Promise<NamedArea> {
  const name = parseAreaName(input.name);
  if (!name) throw new Error("Area name is required");
  const key = areaNameKey(name);
  const db = await ensureDb();
  const existing = await getRow(
    db
      .select()
      .from(namedAreas)
      .where(and(eq(namedAreas.anglerId, anglerId), eq(namedAreas.nameKey, key))),
  );
  const stamp = nowIso();
  const latitude = input.latitude ?? existing?.latitude ?? null;
  const longitude = input.longitude ?? existing?.longitude ?? null;
  if (existing) {
    await runChange(
      db
        .update(namedAreas)
        .set({
          name,
          latitude,
          longitude,
          updatedAt: stamp,
        })
        .where(eq(namedAreas.id, existing.id)),
    );
    return (await getNamedArea(existing.id))!;
  }
  const id = crypto.randomUUID();
  await runChange(
    db.insert(namedAreas).values({
      id,
      anglerId,
      name,
      nameKey: key,
      latitude,
      longitude,
      createdAt: stamp,
      updatedAt: stamp,
    }),
  );
  return (await getNamedArea(id))!;
}

/** Remember a typed/picked place so it is a chip on the next catch. */
export async function rememberNamedArea(
  anglerId: string | null | undefined,
  placeName: string | null | undefined,
  latitude?: number | null,
  longitude?: number | null,
): Promise<NamedArea | null> {
  if (!anglerId) return null;
  const name = parseAreaName(placeName);
  if (!name) return null;
  return upsertNamedArea(anglerId, { name, latitude, longitude });
}

export async function updateNamedArea(
  id: string,
  anglerId: string,
  input: NamedAreaInput,
): Promise<NamedArea | null> {
  const existing = await getNamedArea(id);
  if (!existing || existing.anglerId !== anglerId) return null;
  return upsertNamedArea(anglerId, {
    name: input.name,
    latitude: input.latitude === undefined ? existing.latitude : input.latitude,
    longitude: input.longitude === undefined ? existing.longitude : input.longitude,
  });
}

export async function deleteNamedArea(id: string, anglerId: string): Promise<boolean> {
  const existing = await getNamedArea(id);
  if (!existing || existing.anglerId !== anglerId) return false;
  const db = await ensureDb();
  await runChange(
    db.delete(namedAreas).where(and(eq(namedAreas.id, id), eq(namedAreas.anglerId, anglerId))),
  );
  return true;
}
