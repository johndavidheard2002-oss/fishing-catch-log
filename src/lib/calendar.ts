import { groupSpots } from "./filters";
import type { BaitSpot, CatchRecord, SpotGroup } from "./types";

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

/** Catch pins that have saved coordinates — unpinned trips stay off the map. */
export function spotsWithPins(records: CatchRecord[]): SpotGroup[] {
  return groupSpots(records).filter((s) => s.latitude != null && s.longitude != null);
}

/** Local month-day (MM-DD) so Sep 2 lines up across years. */
export function monthDayKey(dateKeyOrIso: string): string {
  const key = dateKeyOrIso.length <= 10 ? dateKeyOrIso : localDateKey(dateKeyOrIso);
  return key.slice(5, 10);
}

export function yearFromDateKey(dateKeyOrIso: string): number {
  const key = dateKeyOrIso.length <= 10 ? dateKeyOrIso : localDateKey(dateKeyOrIso);
  return Number(key.slice(0, 4));
}

/** Month + day without a year — “Sep 2” for combined-year day detail. */
export function monthDayLabel(dateKeyOrIso: string): string {
  const key = dateKeyOrIso.length <= 10 ? dateKeyOrIso : localDateKey(dateKeyOrIso);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(`${key}T12:00:00`),
  );
}

/** Month + day + year — “Sep 2, 2024” for prior-year day headers. */
export function fullDateLabel(dateKeyOrIso: string): string {
  const key = dateKeyOrIso.length <= 10 ? dateKeyOrIso : localDateKey(dateKeyOrIso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${key}T12:00:00`));
}

/** Every catch on the same month+day, any year. */
export function catchesOnMonthDay(records: CatchRecord[], dateKey: string): CatchRecord[] {
  const md = monthDayKey(dateKey);
  return records.filter((record) => monthDayKey(record.caughtAt) === md);
}

export type YearCatchGroup = {
  year: number;
  dateKey: string;
  catches: CatchRecord[];
};

/** Newest year first; trips inside a year stay earliest-first. */
export function groupCatchesByYear(records: CatchRecord[]): YearCatchGroup[] {
  const map = new Map<number, CatchRecord[]>();
  for (const record of records) {
    const key = localDateKey(record.caughtAt);
    const year = yearFromDateKey(key);
    const list = map.get(year) ?? [];
    list.push(record);
    map.set(year, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, list]) => ({
      year,
      dateKey: localDateKey(list[0].caughtAt),
      catches: [...list].sort((a, b) => a.caughtAt.localeCompare(b.caughtAt)),
    }));
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

export function groupBaitSpotsByDate(spots: BaitSpot[]): Map<string, BaitSpot[]> {
  const groups = new Map<string, BaitSpot[]>();
  for (const spot of spots) {
    const key = localDateKey(spot.loggedAt);
    const list = groups.get(key) ?? [];
    list.push(spot);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  }
  return groups;
}

/** Every bait hole logged on the same month+day, any year. */
export function baitSpotsOnMonthDay(spots: BaitSpot[], dateKey: string): BaitSpot[] {
  const md = monthDayKey(dateKey);
  return spots.filter((spot) => monthDayKey(spot.loggedAt) === md);
}

export type YearBaitGroup = {
  year: number;
  dateKey: string;
  spots: BaitSpot[];
};

/** Newest year first; bait visits inside a year stay earliest-first. */
export function groupBaitSpotsByYear(spots: BaitSpot[]): YearBaitGroup[] {
  const map = new Map<number, BaitSpot[]>();
  for (const spot of spots) {
    const key = localDateKey(spot.loggedAt);
    const year = yearFromDateKey(key);
    const list = map.get(year) ?? [];
    list.push(spot);
    map.set(year, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, list]) => ({
      year,
      dateKey: localDateKey(list[0].loggedAt),
      spots: [...list].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
    }));
}

/** Bait visits with saved coordinates. */
export function baitSpotsWithPins(spots: BaitSpot[]): BaitSpot[] {
  return spots.filter((s) => s.latitude != null && s.longitude != null);
}

export function baitSpotLabel(spot: BaitSpot): string {
  if (spot.placeName?.trim()) return spot.placeName.trim();
  if (spot.latitude != null && spot.longitude != null) {
    return `${spot.latitude.toFixed(3)}, ${spot.longitude.toFixed(3)}`;
  }
  return "Unnamed hole";
}

/** Distinct years that have a catch or bait visit on this month-day. */
export function yearsOnMonthDay(
  catches: CatchRecord[],
  baitSpots: BaitSpot[],
  dateKey: string,
): number[] {
  const years = new Set<number>();
  for (const record of catchesOnMonthDay(catches, dateKey)) {
    years.add(yearFromDateKey(record.caughtAt));
  }
  for (const spot of baitSpotsOnMonthDay(baitSpots, dateKey)) {
    years.add(yearFromDateKey(spot.loggedAt));
  }
  return [...years].sort((a, b) => b - a);
}

export const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
