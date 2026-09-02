export const PRESSURE_TRENDS = ["rising", "falling", "steady"] as const;
export type PressureTrend = (typeof PRESSURE_TRENDS)[number];

export const INHG_PER_MB = 0.02953;
export const MB_PER_INHG = 33.86389;

export function isPressureTrend(value: string): value is PressureTrend {
  return (PRESSURE_TRENDS as readonly string[]).includes(value);
}

export function mbToInHg(mb: number): number {
  return Number((mb * INHG_PER_MB).toFixed(2));
}

export function inHgToMb(inHg: number): number {
  return Number((inHg * MB_PER_INHG).toFixed(1));
}

export function pressureFromMb(mb: number | null | undefined): {
  pressureMb: number | null;
  pressureInHg: number | null;
} {
  if (mb == null || !Number.isFinite(mb)) {
    return { pressureMb: null, pressureInHg: null };
  }
  return { pressureMb: Number(mb.toFixed(1)), pressureInHg: mbToInHg(mb) };
}

export function pressureTrendFromDeltaMb(deltaMb: number | null | undefined): PressureTrend | null {
  if (deltaMb == null || !Number.isFinite(deltaMb)) return null;
  if (deltaMb >= 0.7) return "rising";
  if (deltaMb <= -0.7) return "falling";
  return "steady";
}

export function pressureTrendLabel(trend: PressureTrend | null | undefined): string {
  if (!trend) return "";
  return trend.charAt(0).toUpperCase() + trend.slice(1);
}
