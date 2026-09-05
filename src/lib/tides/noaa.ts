/** Free NOAA CO-OPS tide predictions. No API key. US coasts and Great Lakes stations only. */
import type { TideExtreme } from "./snapshot";

export const NOAA_STATION_RADIUS_NM = 40;
const STATION_CATALOG_TTL_MS = 12 * 60 * 60 * 1000;
const EARTH_RADIUS_NM = 3440.065;

type NearbyResponse = {
  stations?: NoaaStation[];
};

export type NoaaStation = {
  id?: string | number;
  name?: string;
  lat?: number;
  lng?: number;
  distance?: number;
};

type PredictionsResponse = {
  predictions?: { t?: string; v?: string; type?: string }[];
  error?: { message?: string };
};

export type NoaaExtremes = {
  extremes: TideExtreme[];
  stationId: string;
  stationName: string | null;
};

let stationCatalog: { fetchedAt: number; stations: NoaaStation[] } | null = null;

export function resetNoaaStationCache(): void {
  stationCatalog = null;
}

function yyyymmdd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in nautical miles. */
export function nauticalMilesBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * NOAA `/stations.json?type=tidepredictions` ignores lat/lon/radius query
 * params and returns the full catalog (Hawaii first, no `distance`). Pick the
 * nearest station ourselves.
 */
export function pickNearestTideStation(
  stations: NoaaStation[],
  lat: number,
  lon: number,
  radiusNm = NOAA_STATION_RADIUS_NM,
): { id: string; name: string | null; distanceNm: number } | null {
  let best: { id: string; name: string | null; distanceNm: number } | null = null;
  for (const station of stations) {
    if (station.id == null || station.lat == null || station.lng == null) continue;
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lng)) continue;
    const distanceNm = nauticalMilesBetween(lat, lon, station.lat, station.lng);
    if (distanceNm > radiusNm) continue;
    if (!best || distanceNm < best.distanceNm) {
      best = { id: String(station.id), name: station.name ?? null, distanceNm };
    }
  }
  return best;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`NOAA ${res.status}`);
  return res.json();
}

async function loadTideStations(): Promise<NoaaStation[]> {
  if (stationCatalog && Date.now() - stationCatalog.fetchedAt < STATION_CATALOG_TTL_MS) {
    return stationCatalog.stations;
  }
  const url = new URL("https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json");
  url.searchParams.set("type", "tidepredictions");
  const nearby = (await fetchJson(url.toString())) as NearbyResponse;
  const stations = nearby.stations ?? [];
  stationCatalog = { fetchedAt: Date.now(), stations };
  return stations;
}

function parseNoaaExtreme(p: { t?: string; v?: string; type?: string }): TideExtreme | null {
  const type = (p.type ?? "").toLowerCase().includes("h") ? "high" : "low";
  // time_zone=gmt → treat the naive stamp as UTC.
  const atPoint = p.t ? new Date(`${p.t.replace(" ", "T")}Z`) : new Date(NaN);
  const heightFt = Number(p.v);
  if (!Number.isFinite(atPoint.getTime()) || !Number.isFinite(heightFt)) return null;
  return { at: atPoint, type, heightFt };
}

export async function fetchNoaaExtremes(
  lat: number,
  lon: number,
  at: Date,
  options?: { days?: number },
): Promise<NoaaExtremes> {
  const stations = await loadTideStations();
  const station = pickNearestTideStation(stations, lat, lon);
  if (!station) throw new Error("No NOAA tide station nearby");

  const days = Math.max(1, options?.days ?? 1);
  const start = new Date(at.getTime() - 18 * 60 * 60 * 1000);
  const end = new Date(at.getTime() + (days * 24 + 12) * 60 * 60 * 1000);
  const dataUrl = new URL("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter");
  dataUrl.searchParams.set("product", "predictions");
  dataUrl.searchParams.set("application", "TideMark");
  dataUrl.searchParams.set("begin_date", yyyymmdd(start));
  dataUrl.searchParams.set("end_date", yyyymmdd(end));
  dataUrl.searchParams.set("datum", "MLLW");
  dataUrl.searchParams.set("station", station.id);
  dataUrl.searchParams.set("time_zone", "gmt");
  dataUrl.searchParams.set("units", "english");
  dataUrl.searchParams.set("interval", "hilo");
  dataUrl.searchParams.set("format", "json");

  const data = (await fetchJson(dataUrl.toString())) as PredictionsResponse;
  if (data.error?.message) throw new Error(data.error.message);
  const extremes = (data.predictions ?? [])
    .map(parseNoaaExtreme)
    .filter((e): e is TideExtreme => e != null);
  if (extremes.length < 2) throw new Error("NOAA returned too few tide extremes");
  return { extremes, stationId: station.id, stationName: station.name };
}
