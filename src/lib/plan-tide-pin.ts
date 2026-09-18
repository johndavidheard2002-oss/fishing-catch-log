import { parsePlanDate } from "./plan";
import type { PlannedTidePin } from "./plan-tides";

/** Survives refresh so a Plan day keeps the tide station the angler pinned. */
export const PLAN_DAY_TIDE_PIN_STORAGE_KEY = "tide-mark-plan-day-tide-pins";

export type PlanDayTidePin = {
  latitude: number;
  longitude: number;
  placeName?: string | null;
};

function finiteCoord(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parsePlanDayTidePin(raw: unknown): PlanDayTidePin | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { latitude?: unknown; longitude?: unknown; placeName?: unknown };
  const latitude = finiteCoord(row.latitude);
  const longitude = finiteCoord(row.longitude);
  if (latitude == null || longitude == null) return null;
  const placeName =
    typeof row.placeName === "string" && row.placeName.trim() ? row.placeName.trim() : null;
  return { latitude, longitude, placeName };
}

export function planDayTidePinKey(pin: Pick<PlanDayTidePin, "latitude" | "longitude">): string {
  return `${pin.latitude.toFixed(4)},${pin.longitude.toFixed(4)}`;
}

export function plannedTidePinFromDayPin(pin: PlanDayTidePin): PlannedTidePin {
  return {
    latitude: pin.latitude,
    longitude: pin.longitude,
    habitat: "saltwater-inshore",
    caughtAt: null,
    tideHeightFt: null,
    tide: null,
  };
}

/** User-dropped Plan pin wins over the first planned spot’s coords. */
export function planDayTideStation(
  stored: PlanDayTidePin | null | undefined,
  spotPin: PlannedTidePin | null | undefined,
): PlannedTidePin | null {
  const parsed = parsePlanDayTidePin(stored);
  if (parsed) return plannedTidePinFromDayPin(parsed);
  return spotPin ?? null;
}

export function seedPlanDayTidePin(
  stored: PlanDayTidePin | null | undefined,
  spotPin: PlannedTidePin | null | undefined,
): PlanDayTidePin | null {
  return parsePlanDayTidePin(stored) ?? (spotPin ? parsePlanDayTidePin(spotPin) : null);
}

function readPinMap(
  storage?: Pick<Storage, "getItem"> | null,
): Record<string, PlanDayTidePin> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(PLAN_DAY_TIDE_PIN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, PlanDayTidePin> = {};
    for (const [day, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!parsePlanDate(day)) continue;
      const pin = parsePlanDayTidePin(value);
      if (pin) out[day] = pin;
    }
    return out;
  } catch {
    return {};
  }
}

export function readPlanDayTidePins(
  storage?: Pick<Storage, "getItem"> | null,
): Record<string, PlanDayTidePin> {
  return readPinMap(storage);
}

export function readPlanDayTidePin(
  day: string,
  storage?: Pick<Storage, "getItem"> | null,
): PlanDayTidePin | null {
  if (!parsePlanDate(day)) return null;
  return readPinMap(storage)[day] ?? null;
}

export function writePlanDayTidePin(
  day: string,
  pin: PlanDayTidePin | null,
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
): Record<string, PlanDayTidePin> {
  const current = readPinMap(storage);
  if (!storage || !parsePlanDate(day)) return current;
  const parsed = parsePlanDayTidePin(pin);
  if (parsed) current[day] = parsed;
  else delete current[day];
  try {
    storage.setItem(PLAN_DAY_TIDE_PIN_STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* private browsing */
  }
  return current;
}
