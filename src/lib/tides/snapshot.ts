import type { Habitat, Tide } from "../types";

export type TideExtreme = {
  at: Date;
  type: "high" | "low";
  heightFt: number;
};

export type TideSnapshot = {
  applies: boolean;
  tide: Tide | null;
  heightFt: number | null;
  nextHighAt: string | null;
  nextHighFt: number | null;
  nextLowAt: string | null;
  nextLowFt: number | null;
  source: "worldtides" | "noaa" | "none";
  note: string;
  stationName?: string | null;
};

export function emptyTideSnapshot(
  applies: boolean,
  note: string,
  source: TideSnapshot["source"] = "none",
): TideSnapshot {
  return {
    applies,
    tide: null,
    heightFt: null,
    nextHighAt: null,
    nextHighFt: null,
    nextLowAt: null,
    nextLowFt: null,
    source,
    note,
    stationName: null,
  };
}

export function tidesApplyToHabitat(habitat: Habitat | string | null | undefined): boolean {
  return habitat === "saltwater-inshore" || habitat === "saltwater-offshore";
}

export function snapshotFromExtremes(
  extremes: TideExtreme[],
  at: Date,
): Omit<TideSnapshot, "source" | "note" | "applies" | "stationName"> | null {
  const sorted = [...extremes]
    .filter((e) => Number.isFinite(e.at.getTime()) && Number.isFinite(e.heightFt))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (sorted.length < 2) return null;

  const t = at.getTime();
  let prev = sorted[0];
  let next = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].at.getTime() <= t && sorted[i + 1].at.getTime() >= t) {
      prev = sorted[i];
      next = sorted[i + 1];
      break;
    }
    if (sorted[i + 1].at.getTime() < t) {
      prev = sorted[i + 1];
      next = sorted[Math.min(i + 2, sorted.length - 1)];
    }
  }

  const span = next.at.getTime() - prev.at.getTime();
  const frac = span > 0 ? Math.min(1, Math.max(0, (t - prev.at.getTime()) / span)) : 0;
  const heightFt = Number((prev.heightFt + (next.heightFt - prev.heightFt) * frac).toFixed(2));

  const nearMs = 40 * 60 * 1000;
  let tide: Tide = prev.type === "high" ? "outgoing" : "incoming";
  if (Math.abs(prev.at.getTime() - t) <= nearMs) tide = prev.type;
  else if (Math.abs(next.at.getTime() - t) <= nearMs) tide = next.type;

  const nextHigh = sorted.find((e) => e.type === "high" && e.at.getTime() >= t) ?? null;
  const nextLow = sorted.find((e) => e.type === "low" && e.at.getTime() >= t) ?? null;

  return {
    tide,
    heightFt,
    nextHighAt: nextHigh ? nextHigh.at.toISOString() : null,
    nextHighFt: nextHigh ? nextHigh.heightFt : null,
    nextLowAt: nextLow ? nextLow.at.toISOString() : null,
    nextLowFt: nextLow ? nextLow.heightFt : null,
  };
}

/** Civil timezone for a US/Gulf pin so tide clocks are not the host's UTC. */
export function timeZoneFromLongitude(lon: number | null | undefined): string | undefined {
  if (lon == null || !Number.isFinite(lon)) return undefined;
  if (lon <= -129 && lon >= -162) return "Pacific/Honolulu";
  if (lon < -115 && lon > -129) return "America/Los_Angeles";
  if (lon < -102 && lon >= -115) return "America/Denver";
  if (lon < -85 && lon >= -102) return "America/Chicago";
  if (lon < -66 && lon >= -85) return "America/New_York";
  return undefined;
}

export function formatTideClock(
  iso: string | null | undefined,
  timeZone?: string,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}

export function formatTideDetail(
  snap: {
    nextHighAt?: string | null;
    nextHighFt?: number | null;
    nextLowAt?: string | null;
    nextLowFt?: number | null;
    stationName?: string | null;
    longitude?: number | null;
  },
  timeZone?: string,
): string {
  const zone = timeZone ?? timeZoneFromLongitude(snap.longitude);
  const bits: string[] = [];
  if (snap.nextHighAt) {
    bits.push(
      `High ${formatTideClock(snap.nextHighAt, zone)}${snap.nextHighFt != null ? ` ${snap.nextHighFt.toFixed(1)} ft` : ""}`,
    );
  }
  if (snap.nextLowAt) {
    bits.push(
      `Low ${formatTideClock(snap.nextLowAt, zone)}${snap.nextLowFt != null ? ` ${snap.nextLowFt.toFixed(1)} ft` : ""}`,
    );
  }
  if (snap.stationName) bits.push(snap.stationName);
  return bits.join(" · ");
}

export function tideStageLabel(tide: string | null | undefined): string {
  if (!tide) return "";
  return tide.charAt(0).toUpperCase() + tide.slice(1);
}

export function tideWeatherBits(args: {
  habitat?: Habitat | string | null;
  tide?: string | null;
  tideHeightFt?: number | null;
  tideDetail?: string | null;
}): string[] {
  if (!tidesApplyToHabitat(args.habitat)) return [];
  const bits: string[] = [];
  if (args.tide) {
    bits.push(
      args.tideHeightFt != null
        ? `${tideStageLabel(args.tide)} ${args.tideHeightFt.toFixed(1)} ft`
        : `${tideStageLabel(args.tide)} tide`,
    );
  }
  if (args.tideDetail) bits.push(args.tideDetail);
  return bits;
}
