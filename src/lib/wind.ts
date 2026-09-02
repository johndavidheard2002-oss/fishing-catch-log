export const WIND_DIRECTIONS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export type WindDirection = (typeof WIND_DIRECTIONS)[number];

/** Eight-point filter chips; each includes adjacent 16-point bearings. */
export const WIND_CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type WindCardinal = (typeof WIND_CARDINALS)[number];

export function isWindDirection(value: string): value is WindDirection {
  return (WIND_DIRECTIONS as readonly string[]).includes(value);
}

export function degreesToWindDirection(deg: number): WindDirection {
  const d = ((deg % 360) + 360) % 360;
  const i = Math.round(d / 22.5) % 16;
  return WIND_DIRECTIONS[i];
}

export function windDirectionDistance(a: string, b: string): number | null {
  const i = (WIND_DIRECTIONS as readonly string[]).indexOf(a);
  const j = (WIND_DIRECTIONS as readonly string[]).indexOf(b);
  if (i < 0 || j < 0) return null;
  const d = Math.abs(i - j);
  return Math.min(d, 16 - d);
}

const CARDINAL_MEMBERS: Record<WindCardinal, WindDirection[]> = {
  N: ["NNW", "N", "NNE"],
  NE: ["NNE", "NE", "ENE"],
  E: ["ENE", "E", "ESE"],
  SE: ["ESE", "SE", "SSE"],
  S: ["SSE", "S", "SSW"],
  SW: ["SSW", "SW", "WSW"],
  W: ["WSW", "W", "WNW"],
  NW: ["WNW", "NW", "NNW"],
};

export function windMatchesCardinal(direction: string | null | undefined, cardinal: string): boolean {
  if (!direction) return false;
  const members = CARDINAL_MEMBERS[cardinal as WindCardinal];
  if (!members) return direction === cardinal;
  return members.includes(direction as WindDirection);
}
