import type { Tide } from "../types";

type WorldTidesResponse = {
  extremes?: { dt: number; height: number; type: string }[];
  error?: string;
};

export function hasWorldTidesKey(): boolean {
  return Boolean(process.env.WORLDTIDES_API_KEY?.trim());
}

export async function fetchWorldTides(
  lat: number,
  lon: number,
  start: Date,
  days: number,
): Promise<{ at: Date; tide: Tide; heightFt: number }[]> {
  const key = process.env.WORLDTIDES_API_KEY?.trim();
  if (!key) throw new Error("WORLDTIDES_API_KEY is not set");

  const url = new URL("https://www.worldtides.info/api/v3");
  url.searchParams.set("extremes", "1");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("start", String(Math.floor(start.getTime() / 1000)));
  url.searchParams.set("length", String(Math.max(1, days) * 86400));
  url.searchParams.set("datum", "LAT");
  url.searchParams.set("key", key);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`WorldTides error ${res.status}`);
  const data = (await res.json()) as WorldTidesResponse;
  if (data.error) throw new Error(data.error);

  const extremes = [...(data.extremes ?? [])].sort((a, b) => a.dt - b.dt);
  const points: { at: Date; tide: Tide; heightFt: number }[] = [];
  for (let i = 0; i < extremes.length; i++) {
    const ex = extremes[i];
    const type = ex.type.toLowerCase();
    const high = type.includes("high");
    points.push({
      at: new Date(ex.dt * 1000),
      tide: high ? "high" : "low",
      heightFt: Number((ex.height * 3.28084).toFixed(2)),
    });
    const next = extremes[i + 1];
    if (next) {
      const mid = new Date(((ex.dt + next.dt) / 2) * 1000);
      const nextHigh = next.type.toLowerCase().includes("high");
      points.push({
        at: mid,
        tide: high && !nextHigh ? "outgoing" : "incoming",
        heightFt: Number((((ex.height + next.height) / 2) * 3.28084).toFixed(2)),
      });
    }
  }
  return points;
}

export function tideAtTime(
  series: { at: Date; tide: Tide; heightFt: number }[],
  at: Date,
): { tide: Tide; heightFt: number } | null {
  if (!series.length) return null;
  let best = series[0];
  let bestDt = Math.abs(series[0].at.getTime() - at.getTime());
  for (const p of series) {
    const dt = Math.abs(p.at.getTime() - at.getTime());
    if (dt < bestDt) {
      best = p;
      bestDt = dt;
    }
  }
  if (bestDt > 4 * 60 * 60 * 1000) return null;
  return { tide: best.tide, heightFt: best.heightFt };
}
