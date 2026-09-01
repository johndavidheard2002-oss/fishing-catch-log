import type { Season, TimeOfDay } from "./types";

const DAWN_START = 5;
const MORNING_START = 7;
const AFTERNOON_START = 11;
const DUSK_START = 16;
const NIGHT_START = 20;

export function timeOfDayFromDate(date: Date): TimeOfDay {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour >= DAWN_START && hour < MORNING_START) return "dawn";
  if (hour >= MORNING_START && hour < AFTERNOON_START) return "morning";
  if (hour >= AFTERNOON_START && hour < DUSK_START) return "afternoon";
  if (hour >= DUSK_START && hour < NIGHT_START) return "dusk";
  return "night";
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

export function formatDateOnly(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function datetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
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
