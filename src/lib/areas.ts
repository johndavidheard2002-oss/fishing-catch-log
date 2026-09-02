import type { NamedArea, NamedAreaInput } from "./types";

export const MAX_AREA_NAME = 80;

export function areaNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseAreaName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ").slice(0, MAX_AREA_NAME);
  return name.length ? name : null;
}

function asCoord(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseNamedAreaInput(body: Record<string, unknown>): NamedAreaInput | null {
  const name = parseAreaName(body.name);
  if (!name) return null;
  const latitude = asCoord(body.latitude);
  const longitude = asCoord(body.longitude);
  const hasPair = latitude != null && longitude != null;
  return {
    name,
    latitude: hasPair ? latitude : null,
    longitude: hasPair ? longitude : null,
  };
}

export function mergeNamedAreas(saved: NamedArea[], inferred: NamedArea[]): NamedArea[] {
  const byKey = new Map<string, NamedArea>();
  const consider = (area: NamedArea, overwrite: boolean) => {
    const key = areaNameKey(area.name);
    if (!key) return;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, area);
      return;
    }
    if (overwrite) {
      byKey.set(key, {
        ...area,
        latitude: area.latitude ?? existing.latitude,
        longitude: area.longitude ?? existing.longitude,
      });
      return;
    }
    const newer = area.updatedAt > existing.updatedAt;
    byKey.set(key, {
      ...existing,
      latitude: newer ? (area.latitude ?? existing.latitude) : (existing.latitude ?? area.latitude),
      longitude: newer
        ? (area.longitude ?? existing.longitude)
        : (existing.longitude ?? area.longitude),
      updatedAt: newer ? area.updatedAt : existing.updatedAt,
    });
  };
  for (const area of inferred) consider(area, false);
  for (const area of saved) consider(area, true);
  return [...byKey.values()].sort((a, b) => {
    const byTime = b.updatedAt.localeCompare(a.updatedAt);
    if (byTime) return byTime;
    return a.name.localeCompare(b.name);
  });
}
