import { isHabitat, matchesHabitatFilters } from "./habitat";
import { haversineKm } from "./similar";
import type { CatchFilters, CatchRecord, Habitat, SpotGroup } from "./types";

export function matchesFilters(record: CatchRecord, filters: CatchFilters): boolean {
  if (!matchesHabitatFilters(record.habitat, filters.habitats)) return false;

  if (filters.species) {
    const q = filters.species.trim().toLowerCase();
    if (!record.species.toLowerCase().includes(q)) return false;
  }

  if (filters.place) {
    const q = filters.place.trim().toLowerCase();
    const place = (record.placeName ?? "").toLowerCase();
    if (!place.includes(q)) return false;
  }

  if (filters.from && record.caughtAt < filters.from) return false;
  if (filters.to) {
    const end = filters.to.length <= 10 ? `${filters.to}T23:59:59.999Z` : filters.to;
    if (record.caughtAt > end) return false;
  }

  if (filters.seasons?.length && !filters.seasons.includes(record.season)) {
    return false;
  }

  if (filters.timesOfDay?.length && !filters.timesOfDay.includes(record.timeOfDay)) {
    return false;
  }

  if (
    filters.conditions?.length &&
    (!record.weatherCondition || !filters.conditions.includes(record.weatherCondition))
  ) {
    return false;
  }

  if (filters.tempMin != null && (record.temperatureF == null || record.temperatureF < filters.tempMin)) {
    return false;
  }
  if (filters.tempMax != null && (record.temperatureF == null || record.temperatureF > filters.tempMax)) {
    return false;
  }
  if (filters.windMin != null && (record.windSpeedMph == null || record.windSpeedMph < filters.windMin)) {
    return false;
  }
  if (filters.windMax != null && (record.windSpeedMph == null || record.windSpeedMph > filters.windMax)) {
    return false;
  }

  if (
    filters.lat != null &&
    filters.lng != null &&
    filters.radiusKm != null
  ) {
    if (record.latitude == null || record.longitude == null) return false;
    const km = haversineKm(filters.lat, filters.lng, record.latitude, record.longitude);
    if (km > filters.radiusKm) return false;
  }

  return true;
}

export function parseFilters(searchParams: URLSearchParams): CatchFilters {
  const csv = (key: string) => {
    const raw = searchParams.get(key);
    if (!raw) return undefined;
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  };
  const num = (key: string) => {
    const raw = searchParams.get(key);
    if (raw == null || raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    species: searchParams.get("species") || undefined,
    place: searchParams.get("place") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    seasons: csv("season") as CatchFilters["seasons"],
    timesOfDay: csv("time") as CatchFilters["timesOfDay"],
    conditions: csv("condition") as CatchFilters["conditions"],
    tempMin: num("tempMin"),
    tempMax: num("tempMax"),
    windMin: num("windMin"),
    windMax: num("windMax"),
    lat: num("lat"),
    lng: num("lng"),
    radiusKm: num("radiusKm"),
    habitats: csv("habitat")?.filter(isHabitat) as Habitat[] | undefined,
  };
}

function mostCommon<T extends string>(values: T[]): T | null {
  if (!values.length) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function groupSpots(records: CatchRecord[]): SpotGroup[] {
  const groups = new Map<string, CatchRecord[]>();
  for (const record of records) {
    const key = spotKey(record);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .map(([key, catches]) => {
      const withCoords = catches.filter((c) => c.latitude != null && c.longitude != null);
      const lat =
        withCoords.reduce((s, c) => s + (c.latitude ?? 0), 0) / (withCoords.length || 1);
      const lng =
        withCoords.reduce((s, c) => s + (c.longitude ?? 0), 0) / (withCoords.length || 1);
      const temps = catches.map((c) => c.temperatureF).filter((n): n is number => n != null);
      const named = catches.find((c) => c.placeName)?.placeName;
      return {
        key,
        placeName: named ?? key,
        latitude: withCoords.length ? lat : null,
        longitude: withCoords.length ? lng : null,
        catchCount: catches.length,
        species: [...new Set(catches.map((c) => c.species))],
        lastCaughtAt: [...catches].sort((a, b) => b.caughtAt.localeCompare(a.caughtAt))[0]
          .caughtAt,
        typicalCondition: mostCommon(
          catches
            .map((c) => c.weatherCondition)
            .filter((v): v is NonNullable<typeof v> => v != null),
        ),
        typicalSeason: mostCommon(catches.map((c) => c.season)),
        typicalTime: mostCommon(catches.map((c) => c.timeOfDay)),
        avgTempF: temps.length
          ? Math.round(temps.reduce((s, n) => s + n, 0) / temps.length)
          : null,
        catches: [...catches].sort((a, b) => b.caughtAt.localeCompare(a.caughtAt)),
      };
    })
    .sort((a, b) => b.catchCount - a.catchCount);
}

export function spotKey(record: CatchRecord): string {
  if (record.placeName?.trim()) {
    return record.placeName.trim().toLowerCase().replace(/\s+/g, " ");
  }
  if (record.latitude != null && record.longitude != null) {
    return `${record.latitude.toFixed(2)},${record.longitude.toFixed(2)}`;
  }
  return "unknown spot";
}

export function hasActiveFilters(filters: CatchFilters): boolean {
  return Boolean(
    filters.species ||
      filters.place ||
      filters.from ||
      filters.to ||
      filters.seasons?.length ||
      filters.timesOfDay?.length ||
      filters.conditions?.length ||
      filters.tempMin != null ||
      filters.tempMax != null ||
      filters.windMin != null ||
      filters.windMax != null ||
      filters.radiusKm != null ||
      filters.habitats?.length,
  );
}
