import type { Tide } from "../types";
import { demoTide } from "./demo";
import { fetchWorldTides, hasWorldTidesKey, tideAtTime } from "./worldtides";

export async function getTideSeries(
  lat: number,
  lon: number,
  start: Date,
  days: number,
): Promise<{
  source: "worldtides" | "demo";
  note: string;
  at: (when: Date) => { tide: Tide; heightFt: number };
}> {
  if (hasWorldTidesKey()) {
    try {
      const series = await fetchWorldTides(lat, lon, start, days);
      return {
        source: "worldtides",
        note: "Tide extremes from WorldTides.",
        at: (when) => {
          const hit = tideAtTime(series, when);
          if (hit) return hit;
          const fallback = demoTide(lat, lon, when);
          return { tide: fallback.tide, heightFt: fallback.heightFt };
        },
      };
    } catch {
      /* fall through to demo */
    }
  }

  return {
    source: "demo",
    note: "Demo tide series (no WorldTides key). Not a real station prediction.",
    at: (when) => {
      const t = demoTide(lat, lon, when);
      return { tide: t.tide, heightFt: t.heightFt };
    },
  };
}

export { hasWorldTidesKey };
