import type { Season, TimeOfDay } from "./types";

const DAWN_START = 5;
const MORNING_START = 7;
const AFTERNOON_START = 11;
const DUSK_START = 16;
const NIGHT_START = 20;

export function timeOfDayFromHour(hour: number): TimeOfDay {
  if (hour >= DAWN_START && hour < MORNING_START) return "dawn";
  if (hour >= MORNING_START && hour < AFTERNOON_START) return "morning";
  if (hour >= AFTERNOON_START && hour < DUSK_START) return "afternoon";
  if (hour >= DUSK_START && hour < NIGHT_START) return "dusk";
  return "night";
}

export function timeOfDayFromDate(date: Date): TimeOfDay {
  return timeOfDayFromHour(date.getHours() + date.getMinutes() / 60);
}

/** datetime-local only (no Z / offset). Safari treats `new Date("2025-07-12T06:10")` as UTC. */
const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
const EXIF_NAIVE_RE =
  /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

function hasExplicitTimeZone(value: string): boolean {
  const s = value.trim();
  return /[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
}

/** Bucket from the wall-clock in a datetime-local value, ignoring Date UTC parsing quirks. */
export function timeOfDayFromCaughtAtInput(value: string): TimeOfDay | null {
  const local = value.trim().match(DATETIME_LOCAL_RE);
  if (local) return timeOfDayFromHour(Number(local[4]) + Number(local[5]) / 60);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return timeOfDayFromDate(date);
}

export function seasonFromCaughtAtInput(value: string): Season | null {
  const local = value.trim().match(DATETIME_LOCAL_RE);
  if (local) {
    return seasonFromDate(new Date(Number(local[1]), Number(local[2]) - 1, Number(local[3])));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return seasonFromDate(date);
}

function dateFromWallClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute, second);
}

/** Camera EXIF is a naive local clock. Do not UTC-parse `2025:07:12 06:10:00`. */
export function parseExifStamp(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (!hasExplicitTimeZone(raw)) {
    const naive = raw.match(EXIF_NAIVE_RE);
    if (naive) {
      return dateFromWallClock(
        Number(naive[1]),
        Number(naive[2]),
        Number(naive[3]),
        Number(naive[4]),
        Number(naive[5]),
        Number(naive[6] || 0),
      );
    }
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function seasonFromDate(date: Date): Season {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

export function parseCaughtAt(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: ${value}`);
  }
  return date;
}

export function adjacentTimes(time: TimeOfDay): TimeOfDay[] {
  const order: TimeOfDay[] = ["dawn", "morning", "afternoon", "dusk", "night"];
  const i = order.indexOf(time);
  const prev = order[(i + order.length - 1) % order.length];
  const next = order[(i + 1) % order.length];
  return [prev, next];
}

export function formatCaughtAt(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatTimeOnly(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDateOnly(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function dateFromDatetimeLocal(value: string): Date | null {
  const local = value.trim().match(DATETIME_LOCAL_RE);
  if (local) {
    return dateFromWallClock(
      Number(local[1]),
      Number(local[2]),
      Number(local[3]),
      Number(local[4]),
      Number(local[5]),
      Number(local[6] || 0),
    );
  }
  return parseExifStamp(value);
}

/** Persist a datetime-local wall clock as an ISO instant in the user's timezone. */
export function isoFromDatetimeLocal(value: string): string {
  const date = dateFromDatetimeLocal(value);
  return (date ?? new Date()).toISOString();
}

export function datetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export const TIME_OF_DAY_HOURS: Record<TimeOfDay, number> = {
  dawn: 6,
  morning: 9,
  afternoon: 14,
  dusk: 18,
  night: 21.5,
};

/** Shift a UTC instant so getUTC* approximates solar time at longitude. */
export function solarInstant(date: Date, longitude: number | null): Date {
  if (longitude == null || !Number.isFinite(longitude)) return date;
  return new Date(date.getTime() + (longitude / 15) * 60 * 60 * 1000);
}

export function localTimeOfDay(date: Date, longitude: number | null): TimeOfDay {
  const local = solarInstant(date, longitude);
  return timeOfDayFromHour(local.getUTCHours() + local.getUTCMinutes() / 60);
}

export function dateKeyLocal(date: Date, longitude: number | null): string {
  const local = solarInstant(date, longitude);
  return local.toISOString().slice(0, 10);
}

export function formatWeekdayDate(isoOrDay: string): string {
  const date = isoOrDay.length <= 10 ? new Date(`${isoOrDay}T12:00:00`) : new Date(isoOrDay);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  dawn: "Dawn",
  morning: "Morning",
  afternoon: "Afternoon",
  dusk: "Dusk",
  night: "Night",
};

export const SEASON_LABELS: Record<Season, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
};
