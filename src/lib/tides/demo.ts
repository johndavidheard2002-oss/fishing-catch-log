import type { Tide } from "../types";

function hash(lat: number, lon: number, iso: string): number {
  const s = `${lat.toFixed(2)},${lon.toFixed(2)},${iso}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Semidiurnal demo tide (~12.42h). Labeled demo — not a station prediction.
 * Phase uses longitude so east/west coasts aren't identical.
 */
export function demoTide(lat: number, lon: number, at: Date): {
  tide: Tide;
  heightFt: number;
  source: "demo";
  note: string;
} {
  const hours = at.getTime() / 3_600_000 + lon / 15;
  const cycle = 12.4206;
  const angle = ((hours + (hash(lat, lon, "tide") % 7)) / cycle) * 2 * Math.PI;
  const heightFt = Number((1.6 * Math.sin(angle)).toFixed(2));
  const deriv = Math.cos(angle);
  let tide: Tide = "slack";
  if (heightFt > 1.05) tide = "high";
  else if (heightFt < -1.05) tide = "low";
  else if (deriv > 0.15) tide = "incoming";
  else if (deriv < -0.15) tide = "outgoing";
  else tide = "slack";

  return {
    tide,
    heightFt,
    source: "demo",
    note: "Demo tide series (no WorldTides key). Patterned, not a real station.",
  };
}
