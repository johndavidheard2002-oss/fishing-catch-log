export const MOON_PHASES = [
  "New",
  "Waxing crescent",
  "First quarter",
  "Waxing gibbous",
  "Full",
  "Waning gibbous",
  "Last quarter",
  "Waning crescent",
] as const;

export type MoonPhase = (typeof MOON_PHASES)[number];

/** Mean synodic month (days). */
export const SYNODIC_DAYS = 29.530588853;

/** Astronomical new moon 2000-01-06 18:14 UTC. */
const KNOWN_NEW_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

export function isMoonPhase(value: string): value is MoonPhase {
  return (MOON_PHASES as readonly string[]).includes(value);
}

export function moonAgeDays(at: Date): number {
  const days = (at.getTime() - KNOWN_NEW_MS) / 86_400_000;
  const age = days % SYNODIC_DAYS;
  return age < 0 ? age + SYNODIC_DAYS : age;
}

export function moonForDate(at: Date): {
  phase: MoonPhase;
  illumination: number;
  ageDays: number;
} {
  const age = moonAgeDays(at);
  const illumination = Math.round(
    ((1 - Math.cos((2 * Math.PI * age) / SYNODIC_DAYS)) / 2) * 100,
  );
  const step = SYNODIC_DAYS / 8;
  const index = Math.round(age / step) % 8;
  return {
    phase: MOON_PHASES[index],
    illumination,
    ageDays: Number(age.toFixed(3)),
  };
}
