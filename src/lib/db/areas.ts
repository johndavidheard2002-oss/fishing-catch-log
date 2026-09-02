import { and, desc, eq } from "drizzle-orm";
import { areaNameKey, mergeNamedAreas, parseAreaName } from "../areas";
import type { NamedArea, NamedAreaInput } from "../types";
import { getDb, getSqlite } from "./index";
import { namedAreas } from "./schema";

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

type InferredRow = {
  place_name: string;
  latitude: number | null;
  longitude: number | null;
  stamp: string;
};

function inferredFrom(sql: string, anglerId: string, source: NamedArea["source"]): NamedArea[] {
  const sqlite = getSqlite();
  const rows = sqlite.prepare(sql).all(anglerId) as InferredRow[];
  const byKey = new Map<string, NamedArea>();
  for (const row of rows) {
    const name = parseAreaName(row.place_name);
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

export function listSavedNamedAreas(anglerId: string): NamedArea[] {
  const db = getDb();
  const rows = db
    .select()
    .from(namedAreas)
    .where(eq(namedAreas.anglerId, anglerId))
    .orderBy(desc(namedAreas.updatedAt))
    .all();
  return rows.map(mapRow);
}

export function listNamedAreas(anglerId: string): NamedArea[] {
  const fromCatches = inferredFrom(
    `SELECT place_name, latitude, longitude, caught_at AS stamp
     FROM catches
     WHERE angler_id = ? AND place_name IS NOT NULL AND trim(place_name) != ''
     ORDER BY caught_at DESC`,
    anglerId,
    "catch",
  );
  let fromBait: NamedArea[] = [];
  try {
    fromBait = inferredFrom(
      `SELECT place_name, latitude, longitude, logged_at AS stamp
       FROM bait_spots
       WHERE angler_id = ? AND place_name IS NOT NULL AND trim(place_name) != ''
       ORDER BY logged_at DESC`,
      anglerId,
      "bait",
    );
  } catch {
    fromBait = [];
  }
  return mergeNamedAreas(listSavedNamedAreas(anglerId), [...fromCatches, ...fromBait]);
}

export function getNamedArea(id: string): NamedArea | null {
  const db = getDb();
  const row = db.select().from(namedAreas).where(eq(namedAreas.id, id)).get();
  return row ? mapRow(row) : null;
}

export function upsertNamedArea(anglerId: string, input: NamedAreaInput): NamedArea {
  const name = parseAreaName(input.name);
  if (!name) throw new Error("Area name is required");
  const key = areaNameKey(name);
  const db = getDb();
  const existing = db
    .select()
    .from(namedAreas)
    .where(and(eq(namedAreas.anglerId, anglerId), eq(namedAreas.nameKey, key)))
    .get();
  const stamp = nowIso();
  const latitude = input.latitude ?? existing?.latitude ?? null;
  const longitude = input.longitude ?? existing?.longitude ?? null;
  if (existing) {
    db.update(namedAreas)
      .set({
        name,
        latitude,
        longitude,
        updatedAt: stamp,
      })
      .where(eq(namedAreas.id, existing.id))
      .run();
    return getNamedArea(existing.id)!;
  }
  const id = crypto.randomUUID();
  db.insert(namedAreas)
    .values({
      id,
      anglerId,
      name,
      nameKey: key,
      latitude,
      longitude,
      createdAt: stamp,
      updatedAt: stamp,
    })
    .run();
  return getNamedArea(id)!;
}

/** Remember a typed/picked place so it is a chip on the next catch. */
export function rememberNamedArea(
  anglerId: string | null | undefined,
  placeName: string | null | undefined,
  latitude?: number | null,
  longitude?: number | null,
): NamedArea | null {
  if (!anglerId) return null;
  const name = parseAreaName(placeName);
  if (!name) return null;
  return upsertNamedArea(anglerId, { name, latitude, longitude });
}

export function updateNamedArea(
  id: string,
  anglerId: string,
  input: NamedAreaInput,
): NamedArea | null {
  const existing = getNamedArea(id);
  if (!existing || existing.anglerId !== anglerId) return null;
  return upsertNamedArea(anglerId, {
    name: input.name,
    latitude: input.latitude === undefined ? existing.latitude : input.latitude,
    longitude: input.longitude === undefined ? existing.longitude : input.longitude,
  });
}

export function deleteNamedArea(id: string, anglerId: string): boolean {
  const existing = getNamedArea(id);
  if (!existing || existing.anglerId !== anglerId) return false;
  const db = getDb();
  db.delete(namedAreas)
    .where(and(eq(namedAreas.id, id), eq(namedAreas.anglerId, anglerId)))
    .run();
  return true;
}
