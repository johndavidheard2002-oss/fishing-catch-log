import { groupSpots } from "./filters";
import type { CatchRecord } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day for a Date (YYYY-MM-DD). */
export function localDateKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local calendar day for a catch timestamp (YYYY-MM-DD). */
export function localDateKey(iso: string): string {
  return localDateKeyFromDate(new Date(iso));
}

export function todayKey(): string {
  return localDateKeyFromDate(new Date());
}

export function parseYearMonth(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month: month - 1 };
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1),
  );
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const next = new Date(year, month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

export type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
};

export function monthGrid(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    const date = new Date(year, month - 1, day);
    cells.push({ date: localDateKeyFromDate(date), day, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({ date: localDateKeyFromDate(date), day, inMonth: true });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const date = new Date(year, month + 1, nextDay);
    cells.push({
      date: localDateKeyFromDate(date),
      day: nextDay,
      inMonth: false,
    });
    nextDay += 1;
  }

  return cells;
}

export function groupCatchesByDate(records: CatchRecord[]): Map<string, CatchRecord[]> {
  const groups = new Map<string, CatchRecord[]>();
  for (const record of records) {
    const key = localDateKey(record.caughtAt);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.caughtAt.localeCompare(b.caughtAt));
  }
  return groups;
}

export function catchSpotLabel(record: CatchRecord): string {
  if (record.placeName?.trim()) return record.placeName.trim();
  if (record.latitude != null && record.longitude != null) {
    return `${record.latitude.toFixed(3)}, ${record.longitude.toFixed(3)}`;
  }
  return "Unnamed spot";
}

/** Distinct catch pins in first-seen order — same place name, different water stays separate. */
export function uniqueSpotLabels(records: CatchRecord[]): string[] {
  return groupSpots(records)
    .slice()
    .sort((a, b) => {
      const aFirst = [...a.catches].sort((x, y) => x.caughtAt.localeCompare(y.caughtAt))[0]
        .caughtAt;
      const bFirst = [...b.catches].sort((x, y) => x.caughtAt.localeCompare(y.caughtAt))[0]
        .caughtAt;
      return aFirst.localeCompare(bFirst);
    })
    .map((group) => group.placeName);
}

export const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
