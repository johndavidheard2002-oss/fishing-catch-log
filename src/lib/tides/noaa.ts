/** Free NOAA CO-OPS tide predictions. No API key. US coasts and Great Lakes stations only. */
import type { TideExtreme } from "./snapshot";

type NearbyResponse = {
  stations?: { id?: string | number; name?: string; lat?: number; lng?: number; distance?: number }[];
};

type PredictionsResponse = {
  predictions?: { t?: string; v?: string; type?: string }[];
  error?: { message?: string };
};

function yyyymmdd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
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

export async function fetchNoaaExtremes(
  lat: number,
  lon: number,
  at: Date,
): Promise<{ extremes: TideExtreme[]; stationName: string | null }> {
  const nearbyUrl = new URL("https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json");
  nearbyUrl.searchParams.set("type", "tidepredictions");
  nearbyUrl.searchParams.set("lat", String(lat));
  nearbyUrl.searchParams.set("lon", String(lon));
  nearbyUrl.searchParams.set("radius", "40");
  nearbyUrl.searchParams.set("units", "english");

  const nearby = (await fetchJson(nearbyUrl.toString())) as NearbyResponse;
  const stations = [...(nearby.stations ?? [])].sort(
    (a, b) => (a.distance ?? 999) - (b.distance ?? 999),
  );
  const station = stations.find((s) => s.id != null);
  if (!station?.id) throw new Error("No NOAA tide station nearby");

  const start = new Date(at.getTime() - 18 * 60 * 60 * 1000);
  const end = new Date(at.getTime() + 30 * 60 * 60 * 1000);
  const dataUrl = new URL("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter");
  dataUrl.searchParams.set("product", "predictions");
  dataUrl.searchParams.set("application", "CatchCompass");
  dataUrl.searchParams.set("begin_date", yyyymmdd(start));
  dataUrl.searchParams.set("end_date", yyyymmdd(end));
  dataUrl.searchParams.set("datum", "MLLW");
  dataUrl.searchParams.set("station", String(station.id));
  dataUrl.searchParams.set("time_zone", "gmt");
  dataUrl.searchParams.set("units", "english");
  dataUrl.searchParams.set("interval", "hilo");
  dataUrl.searchParams.set("format", "json");

  const data = (await fetchJson(dataUrl.toString())) as PredictionsResponse;
  if (data.error?.message) throw new Error(data.error.message);
  const extremes: TideExtreme[] = (data.predictions ?? [])
    .map((p) => {
      const type = (p.type ?? "").toLowerCase().includes("h") ? "high" : "low";
      const atPoint = p.t ? new Date(`${p.t.replace(" ", "T")}Z`) : new Date(NaN);
      return {
        at: atPoint,
        type: type as "high" | "low",
        heightFt: Number(p.v),
      };
    })
    .filter((e) => Number.isFinite(e.at.getTime()) && Number.isFinite(e.heightFt));
  if (extremes.length < 2) throw new Error("NOAA returned too few tide extremes");
  return { extremes, stationName: station.name ?? null };
}
