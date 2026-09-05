import type { Habitat, Tide } from "../types";
import { demoTide } from "./demo";
import { fetchNoaaExtremes } from "./noaa";
import {
  emptyTideSnapshot,
  snapshotFromExtremes,
  timeZoneFromLongitude,
  tidesApplyToHabitat,
  type TideExtreme,
  type TideSnapshot,
} from "./snapshot";
import { fetchWorldTides, hasWorldTidesKey, tideAtTime } from "./worldtides";

export async function getTideSeries(
  lat: number,
  lon: number,
  start: Date,
  days: number,
): Promise<{
  source: "noaa" | "worldtides" | "demo";
  note: string;
  at: (when: Date) => { tide: Tide; heightFt: number };
}> {
  try {
    const { extremes, stationName } = await fetchNoaaExtremes(lat, lon, start, { days });
    return {
      source: "noaa",
      note: stationName
        ? `Tide extremes from NOAA ${stationName}.`
        : "Tide extremes from the nearest NOAA station.",
      at: (when) => {
        const snap = snapshotFromExtremes(extremes, when);
        if (snap?.tide && snap.heightFt != null) {
          return { tide: snap.tide, heightFt: snap.heightFt };
        }
        const fallback = demoTide(lat, lon, when);
        return { tide: fallback.tide, heightFt: fallback.heightFt };
      },
    };
  } catch {
    /* WorldTides, then labeled demo */
  }

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
    note: "Demo tide series (no nearby NOAA station). Not a real station prediction.",
    at: (when) => {
      const t = demoTide(lat, lon, when);
      return { tide: t.tide, heightFt: t.heightFt };
    },
  };
}

export async function getTideSnapshot(args: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  at: Date;
  habitat?: Habitat | string | null;
}): Promise<TideSnapshot> {
  if (!tidesApplyToHabitat(args.habitat)) {
    const note =
      args.habitat === "duck"
        ? "Tides are not used for duck logs."
        : "Tides do not apply to this freshwater.";
    return emptyTideSnapshot(false, note);
  }
  if (args.latitude == null || args.longitude == null) {
    return emptyTideSnapshot(true, "Pin the water to look up tide.");
  }
  if (Number.isNaN(args.at.getTime()) || args.at.getTime() <= 0) {
    return emptyTideSnapshot(true, "Set the catch time to look up tide.");
  }

  const lat = args.latitude;
  const lon = args.longitude;
  const start = new Date(args.at.getTime() - 12 * 60 * 60 * 1000);

  try {
    const { extremes, stationName, stationId } = await fetchNoaaExtremes(lat, lon, args.at);
    const snap = snapshotFromExtremes(extremes, args.at, timeZoneFromLongitude(lon));
    if (snap) {
      const label = stationName ? `${stationName} (${stationId})` : stationId;
      return {
        applies: true,
        ...snap,
        source: "noaa",
        note: `Tide from NOAA ${label}.`,
        stationName,
      };
    }
  } catch {
    /* try WorldTides outside NOAA coverage */
  }

  if (hasWorldTidesKey()) {
    try {
      const series = await fetchWorldTides(lat, lon, start, 2);
      const extremes: TideExtreme[] = series
        .filter((p) => p.tide === "high" || p.tide === "low")
        .map((p) => ({ at: p.at, type: p.tide as "high" | "low", heightFt: p.heightFt }));
      const snap = snapshotFromExtremes(extremes, args.at, timeZoneFromLongitude(lon));
      if (snap) {
        return {
          applies: true,
          ...snap,
          source: "worldtides",
          note: "Tide from WorldTides at this pin and time.",
        };
      }
    } catch {
      /* no invented fallback */
    }
  }

  return emptyTideSnapshot(
    true,
    "No tide station for this pin. Enter the tide if you remember it.",
  );
}

export { hasWorldTidesKey, tidesApplyToHabitat };
export type { TideSnapshot };
