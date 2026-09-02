import { isHabitat, matchesHabitatFilters } from "./habitat";
import { isMoonPhase } from "./moon";
import { isPressureTrend } from "./pressure";
import { haversineKm } from "./similar";
import { speciesListMatchesQuery } from "./species";
import { speciesFishCounts } from "./count";
import type { CatchFilters, CatchRecord, Habitat, SpotGroup } from "./types";
import { windMatchesCardinal } from "./wind";

export function matchesFilters(record: CatchRecord, filters: CatchFilters): boolean {
  if (!matchesHabitatFilters(record.habitat, filters.habitats)) return false;

  if (filters.species) {
    const q = filters.species.trim().toLowerCase();
    const list = record.speciesList?.length ? record.speciesList : [record.species];
    if (!speciesListMatchesQuery(list, q)) return false;
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

  if (filters.windDirections?.length) {
    if (!record.windDirection) return false;
    const hit = filters.windDirections.some(
      (dir) =>
        record.windDirection === dir || windMatchesCardinal(record.windDirection, dir),
    );
    if (!hit) return false;
  }

  if (filters.moonPhases?.length) {
    if (!record.moonPhase || !filters.moonPhases.includes(record.moonPhase)) return false;
  }

  if (filters.pressureTrends?.length) {
    if (!record.pressureTrend || !filters.pressureTrends.includes(record.pressureTrend)) {
      return false;
    }
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
    windDirections: csv("windDir"),
    moonPhases: csv("moon")?.filter(isMoonPhase),
    pressureTrends: csv("pressureTrend")?.filter(isPressureTrend),
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

/** Same hole / GPS jitter vs a different piece of water on the same day. */
export const SAME_SPOT_KM = 2;

function placeNameKey(record: CatchRecord): string | null {
  const name = record.placeName?.trim();
  if (!name) return null;
  return name.toLowerCase().replace(/\s+/g, " ");
}

function clusterCenter(cluster: CatchRecord[]): { lat: number; lon: number } | null {
  const withCoords = cluster.filter((c) => c.latitude != null && c.longitude != null);
  if (!withCoords.length) return null;
  return {
    lat: withCoords.reduce((s, c) => s + (c.latitude ?? 0), 0) / withCoords.length,
    lon: withCoords.reduce((s, c) => s + (c.longitude ?? 0), 0) / withCoords.length,
  };
}

function belongsToCluster(cluster: CatchRecord[], record: CatchRecord): boolean {
  const center = clusterCenter(cluster);
  if (record.latitude != null && record.longitude != null && center) {
    return haversineKm(center.lat, center.lon, record.latitude, record.longitude) <= SAME_SPOT_KM;
  }
  const a = placeNameKey(cluster[0]);
  const b = placeNameKey(record);
  return Boolean(a && b && a === b);
}

export function groupSpots(records: CatchRecord[]): SpotGroup[] {
  const clusters: CatchRecord[][] = [];
  for (const record of records) {
    const hit = clusters.find((cluster) => belongsToCluster(cluster, record));
    if (hit) hit.push(record);
    else clusters.push([record]);
  }

  const groups = clusters
    .map((catches) => {
      const center = clusterCenter(catches);
      const named = catches.find((c) => c.placeName)?.placeName;
      const key = center
        ? `${center.lat.toFixed(3)},${center.lon.toFixed(3)}`
        : spotKey(catches[0]);
      return {
        key,
        placeName: named ?? key,
        latitude: center?.lat ?? null,
        longitude: center?.lon ?? null,
        catchCount: catches.length,
        fishCount: catches.reduce((n, c) => n + (c.fishCount || 1), 0),
        species: [
          ...new Set(catches.flatMap((c) => (c.speciesList?.length ? c.speciesList : [c.species]))),
        ],
        speciesCounts: speciesFishCounts(catches),
        lastCaughtAt: [...catches].sort((a, b) => b.caughtAt.localeCompare(a.caughtAt))[0]
          .caughtAt,
        typicalCondition: mostCommon(
          catches
            .map((c) => c.weatherCondition)
            .filter((v): v is NonNullable<typeof v> => v != null),
        ),
        typicalSeason: mostCommon(catches.map((c) => c.season)),
        typicalTime: mostCommon(catches.map((c) => c.timeOfDay)),
        avgTempF: (() => {
          const temps = catches.map((c) => c.temperatureF).filter((n): n is number => n != null);
          return temps.length ? Math.round(temps.reduce((s, n) => s + n, 0) / temps.length) : null;
        })(),
        catches: [...catches].sort((a, b) => b.caughtAt.localeCompare(a.caughtAt)),
      };
    })
    .sort((a, b) => b.catchCount - a.catchCount);

  const nameCount = new Map<string, number>();
  for (const group of groups) {
    nameCount.set(group.placeName, (nameCount.get(group.placeName) ?? 0) + 1);
  }
  return groups.map((group) => {
    if (
      (nameCount.get(group.placeName) ?? 0) > 1 &&
      group.latitude != null &&
      group.longitude != null
    ) {
      return {
        ...group,
        placeName: `${group.placeName} · ${group.latitude.toFixed(3)}, ${group.longitude.toFixed(3)}`,
      };
    }
    return group;
  });
}

export function spotKey(record: CatchRecord): string {
  if (record.latitude != null && record.longitude != null) {
    return `${record.latitude.toFixed(3)},${record.longitude.toFixed(3)}`;
  }
  if (record.placeName?.trim()) {
    return record.placeName.trim().toLowerCase().replace(/\s+/g, " ");
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
      filters.windDirections?.length ||
      filters.moonPhases?.length ||
      filters.pressureTrends?.length ||
      filters.radiusKm != null ||
      filters.habitats?.length,
  );
}
