import { personalPhotoSrc, photoSrc } from "./photo";
import type {
  BaitPlanSuggestion,
  CalendarNote,
  CalendarNoteInput,
  CalendarNoteKind,
  PlanSuggestion,
} from "./types";

export const JOURNAL_NOTE_KIND: CalendarNoteKind = "journal";
export const PLAN_SPOT_NOTE_KIND: CalendarNoteKind = "plan-spot";

export const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_TITLE = 80;
const MAX_NOTES = 2000;
const MAX_PLACE = 120;
const MAX_SPECIES = 8;
const MAX_SOURCE_ID = 80;
const MAX_PHOTO = 240;

function trimToNull(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length ? trimmed : null;
}

export function parseSpeciesTargets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const name = item.trim().slice(0, 40);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_SPECIES) break;
  }
  return out;
}

export function parseSpeciesTargetsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    return parseSpeciesTargets(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

/** Title, notes, place, or at least one species — otherwise there is nothing to save. */
export function calendarNoteHasContent(input: {
  title?: string | null;
  notes?: string | null;
  placeName?: string | null;
  speciesTargets?: string[] | null;
}): boolean {
  return Boolean(
    input.title?.trim() ||
      input.notes?.trim() ||
      input.placeName?.trim() ||
      (input.speciesTargets && input.speciesTargets.length),
  );
}

/** Plan’s notes field — keep title/place/species from a Calendar Log note. */
export function planNoteInput(
  day: string,
  notesText: string,
  existing?: (Pick<CalendarNote, "title" | "placeName" | "speciesTargets"> & {
    kind?: CalendarNoteKind | null;
  }) | null,
): CalendarNoteInput {
  return {
    day,
    notes: trimToNull(notesText, MAX_NOTES),
    title: existing?.title ?? null,
    placeName: existing?.placeName ?? null,
    speciesTargets: existing?.speciesTargets ?? [],
    kind: existing?.kind === PLAN_SPOT_NOTE_KIND ? PLAN_SPOT_NOTE_KIND : JOURNAL_NOTE_KIND,
  };
}

export function parseCalendarNoteKind(value: unknown): CalendarNoteKind {
  return value === PLAN_SPOT_NOTE_KIND ? PLAN_SPOT_NOTE_KIND : JOURNAL_NOTE_KIND;
}

export function isPlanSpotNote(note: { kind?: string | null }): boolean {
  return note.kind === PLAN_SPOT_NOTE_KIND;
}

/** Calendar Log Planned trips — never includes Plan-only suggested spots. */
export function journalNotesForCalendarLog(notes: CalendarNote[]): CalendarNote[] {
  return notes.filter((note) => !isPlanSpotNote(note));
}

export function normalizeNotePlace(place?: string | null): string {
  return (place ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export type PlanSpotSource = {
  placeName?: string | null;
  speciesTargets?: string[] | null;
  sourceCatchId?: string | null;
  sourceBaitId?: string | null;
  catchId?: string | null;
  baitId?: string | null;
  photoPath?: string | null;
};

function planSpotSourceFields(spot: PlanSpotSource): Partial<CalendarNoteInput> {
  const sourceCatchId = trimToNull(spot.sourceCatchId ?? spot.catchId, MAX_SOURCE_ID);
  const sourceBaitId = trimToNull(spot.sourceBaitId ?? spot.baitId, MAX_SOURCE_ID);
  const photoPath = trimToNull(spot.photoPath, MAX_PHOTO);
  const fields: Partial<CalendarNoteInput> = {};
  if (sourceCatchId) fields.sourceCatchId = sourceCatchId;
  if (sourceBaitId) fields.sourceBaitId = sourceBaitId;
  if (photoPath) fields.photoPath = photoPath;
  return fields;
}

/** Suggested Plan spot → a calendar note that pins that place onto the day. */
export function planSpotNoteInput(day: string, spot: PlanSpotSource): CalendarNoteInput | null {
  if (!DAY_KEY_RE.test(day)) return null;
  const placeName = trimToNull(spot.placeName, MAX_PLACE);
  if (!placeName) return null;
  const input: CalendarNoteInput = {
    day,
    title: null,
    notes: null,
    placeName,
    speciesTargets: parseSpeciesTargets(spot.speciesTargets),
    kind: PLAN_SPOT_NOTE_KIND,
    ...planSpotSourceFields(spot),
  };
  return calendarNoteHasContent(input) ? input : null;
}

export function dayHasPlanSpot(
  notes: Array<{ placeName?: string | null; kind?: string | null }>,
  placeName?: string | null,
): boolean {
  const key = normalizeNotePlace(placeName);
  if (!key) return false;
  return notes.some(
    (note) => isPlanSpotNote(note) && normalizeNotePlace(note.placeName) === key,
  );
}

export function plannedSpotsOnDay(notes: CalendarNote[]): CalendarNote[] {
  return notes.filter((note) => isPlanSpotNote(note) && Boolean(note.placeName?.trim()));
}

/** Build a save payload only when that place is not already on the Plan day. */
export function addPlanSpotToDay(
  notes: Array<{ placeName?: string | null; kind?: string | null }>,
  day: string,
  spot: PlanSpotSource,
): CalendarNoteInput | null {
  const input = planSpotNoteInput(day, spot);
  if (!input || dayHasPlanSpot(notes, input.placeName)) return null;
  return input;
}

export function parseCalendarNoteInput(body: Record<string, unknown>): CalendarNoteInput | null {
  const day = typeof body.day === "string" ? body.day.trim() : "";
  if (!DAY_KEY_RE.test(day)) return null;
  const title = trimToNull(body.title, MAX_TITLE);
  const notes = trimToNull(body.notes, MAX_NOTES);
  const placeName = trimToNull(body.placeName, MAX_PLACE);
  const speciesTargets = parseSpeciesTargets(body.speciesTargets);
  const kind = parseCalendarNoteKind(body.kind);
  const input: CalendarNoteInput = {
    day,
    title,
    notes,
    placeName,
    speciesTargets,
    kind,
    ...planSpotSourceFields({
      sourceCatchId: typeof body.sourceCatchId === "string" ? body.sourceCatchId : undefined,
      sourceBaitId: typeof body.sourceBaitId === "string" ? body.sourceBaitId : undefined,
      catchId: typeof body.catchId === "string" ? body.catchId : undefined,
      baitId: typeof body.baitId === "string" ? body.baitId : undefined,
      photoPath: typeof body.photoPath === "string" ? body.photoPath : undefined,
    }),
  };
  if (!calendarNoteHasContent(input)) return null;
  return input;
}

/** YYYY-MM-DD from a query or form value. */
export function parseDayKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const day = value.trim();
  return DAY_KEY_RE.test(day) ? day : null;
}

/** Auto-clear a Plan day when local today is this many days after that day. */
export const PLAN_DAY_AUTO_PURGE_AFTER_DAYS = 3;

function padDayPart(n: number): string {
  return String(n).padStart(2, "0");
}

/** Shift a YYYY-MM-DD key by whole calendar days (UTC date arithmetic — no TZ drift). */
export function shiftDayKey(day: string, deltaDays: number): string | null {
  if (!DAY_KEY_RE.test(day)) return null;
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + deltaDays));
  return `${shifted.getUTCFullYear()}-${padDayPart(shifted.getUTCMonth() + 1)}-${padDayPart(shifted.getUTCDate())}`;
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function dayKeyDiff(from: string, to: string): number | null {
  if (!DAY_KEY_RE.test(from) || !DAY_KEY_RE.test(to)) return null;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Server UTC calendar day — used to reject a client `today` that would over-purge. */
export function utcTodayKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${padDayPart(now.getUTCMonth() + 1)}-${padDayPart(now.getUTCDate())}`;
}

/**
 * A Plan-list `today` may be 1 calendar day off the server (timezones).
 * A selected future plan date or a clock 3+ days ahead is not a valid purge clock.
 */
export function isPlausiblePlanToday(today: string, serverToday: string): boolean {
  const diff = dayKeyDiff(serverToday, today);
  return diff != null && Math.abs(diff) <= 1;
}

/**
 * Exclusive purge cutoff that cannot run ahead of the server day.
 * Timezone-ahead clients use the earlier day; implausible `today` skips purge.
 */
export function safePlanDayPurgeBeforeKey(today: string, serverToday: string): string | null {
  if (!DAY_KEY_RE.test(today) || !DAY_KEY_RE.test(serverToday)) return null;
  if (!isPlausiblePlanToday(today, serverToday)) return null;
  const safeToday = today < serverToday ? today : serverToday;
  return planDayPurgeBeforeKey(safeToday);
}

/**
 * Exclusive cutoff: notes with `day <` this key are old enough to auto-purge.
 * Keep the plan day and the next 2 local days (`today - 2` stays).
 */
export function planDayPurgeBeforeKey(today: string): string | null {
  return shiftDayKey(today, -(PLAN_DAY_AUTO_PURGE_AFTER_DAYS - 1));
}

/** True when local today is 3+ calendar days after that Plan day. */
export function isExpiredPlanDay(day: string, today: string): boolean {
  const before = planDayPurgeBeforeKey(today);
  return Boolean(before && DAY_KEY_RE.test(day) && day < before);
}

export function planNotesOnDay<T extends { day: string }>(notes: T[], day: string): T[] {
  return notes.filter((note) => note.day === day);
}

/** Notes old enough to auto-purge — keep today, future, and the 2 days after a plan day. */
export function expiredPlanNotes<T extends { day: string }>(notes: T[], today: string): T[] {
  return notes.filter((note) => isExpiredPlanDay(note.day, today));
}

/** Plan notes that should still show — not yet 3 days after their plan day. */
export function upcomingPlanNotes<T extends { day: string }>(notes: T[], today: string): T[] {
  return notes.filter((note) => !isExpiredPlanDay(note.day, today));
}

/**
 * GET / remount pipeline: keep plan-spots and write-ups that are not 3+ days old.
 * A missing or non-array list is treated as “no update”, not an empty plan.
 */
export function listedPlanNotes<T extends { day: string }>(
  notes: T[] | null | undefined,
  today: string,
): T[] | null {
  if (!Array.isArray(notes)) return null;
  return upcomingPlanNotes(notes, today);
}

/**
 * Remount refetch: trust a successful list, but do not replace surviving
 * plan-spots / write-ups with an empty payload (failed purge / empty cache).
 */
export function mergeListedPlanNotes<T extends { day: string }>(
  current: T[],
  listed: T[] | null | undefined,
  today: string,
): T[] {
  if (!Array.isArray(listed)) return upcomingPlanNotes(current, today);
  const next = upcomingPlanNotes(listed, today);
  if (next.length) return next;
  const keep = upcomingPlanNotes(current, today);
  return keep.length ? keep : next;
}

export type PlannedPlacePhoto = {
  id: string;
  placeName: string;
  src: string;
  href: string;
};

function photoFromPlanSpotSource(note: CalendarNote): PlannedPlacePhoto | null {
  const placeName = note.placeName?.trim() || "spot";
  if (note.sourceBaitId && !note.sourceCatchId) {
    const src = personalPhotoSrc(note.photoPath);
    if (!src) return null;
    return { id: note.id, placeName, src, href: `/bait/${note.sourceBaitId}` };
  }
  if (note.photoPath) {
    const src = note.sourceCatchId ? photoSrc(note.photoPath) : personalPhotoSrc(note.photoPath);
    if (!src) return null;
    return {
      id: note.id,
      placeName,
      src,
      href: note.sourceCatchId ? `/catch/${note.sourceCatchId}` : `/bait/${note.sourceBaitId ?? ""}`,
    };
  }
  return null;
}

/**
 * Planned thumbs: the catch/bait the angler added, then suggestion matches.
 * A bait add without a photo never borrows another picture.
 */
export function photosForPlannedPlaces(
  spots: CalendarNote[],
  suggestions: PlanSuggestion[] = [],
  baitSuggestions: BaitPlanSuggestion[] = [],
): PlannedPlacePhoto[] {
  const photos: PlannedPlacePhoto[] = [];
  for (const note of spots) {
    const fromSource = photoFromPlanSpotSource(note);
    if (fromSource) {
      photos.push(fromSource);
      continue;
    }
    if (note.sourceBaitId && !note.sourceCatchId) continue;
    const key = normalizeNotePlace(note.placeName);
    if (!key) continue;
    const catchCard = suggestions.find((s) => normalizeNotePlace(s.placeName) === key);
    const catchMatch = catchCard?.matches.find((m) => personalPhotoSrc(m.catch.photoPath));
    if (catchMatch) {
      const src = personalPhotoSrc(catchMatch.catch.photoPath);
      if (src) {
        photos.push({
          id: note.id,
          placeName: note.placeName ?? catchCard?.placeName ?? "spot",
          src,
          href: `/catch/${catchMatch.catch.id}`,
        });
        continue;
      }
    }
    if (note.sourceCatchId) continue;
    const baitCard = baitSuggestions.find((s) => normalizeNotePlace(s.placeName) === key);
    const baitMatch = baitCard?.matches.find((m) => personalPhotoSrc(m.baitSpot.photoPath));
    if (baitMatch) {
      const src = personalPhotoSrc(baitMatch.baitSpot.photoPath);
      if (src) {
        photos.push({
          id: note.id,
          placeName: note.placeName ?? baitCard?.placeName ?? "spot",
          src,
          href: `/bait/${baitMatch.baitSpot.id}`,
        });
      }
    }
  }
  return photos;
}

/** Keep thumbs for plan-spots that are still on the day while suggestions reload. */
export function mergePlannedPlacePhotos(
  spots: Array<{ id: string }>,
  fresh: PlannedPlacePhoto[],
  cached: PlannedPlacePhoto[] = [],
): PlannedPlacePhoto[] {
  const byId = new Map<string, PlannedPlacePhoto>();
  for (const photo of cached) byId.set(photo.id, photo);
  for (const photo of fresh) byId.set(photo.id, photo);
  return spots.flatMap((spot) => {
    const photo = byId.get(spot.id);
    return photo ? [photo] : [];
  });
}

/**
 * Which day the Planned panel should open on after leaving Plan and coming back.
 * A still-valid `?date=` (or last picked day) wins; otherwise the soonest day
 * that still has notes — today, then the next future day, then the latest grace day.
 */
export function restorePlanDay(
  notes: Array<{ day: string }>,
  today: string,
  requestedDay?: string | null,
): string | null {
  const requested = parseDayKey(requestedDay);
  if (requested && !isExpiredPlanDay(requested, today)) return requested;
  const days = [...new Set(upcomingPlanNotes(notes, today).map((note) => note.day))].sort();
  if (days.includes(today)) return today;
  const future = days.find((day) => day > today);
  if (future) return future;
  return days.length ? days[days.length - 1]! : null;
}

export function groupNotesByDay(notes: CalendarNote[]): Map<string, CalendarNote[]> {
  const groups = new Map<string, CalendarNote[]>();
  for (const note of notes) {
    const list = groups.get(note.day) ?? [];
    list.push(note);
    groups.set(note.day, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return groups;
}

export function noteHeadline(note: CalendarNote): string {
  if (note.title?.trim()) return note.title.trim();
  if (note.placeName?.trim()) return note.placeName.trim();
  if (note.speciesTargets.length) return note.speciesTargets.join(", ");
  if (note.notes?.trim()) {
    const line = note.notes.trim().split("\n")[0] ?? "";
    return line.length > 48 ? `${line.slice(0, 45)}…` : line;
  }
  return "Planned trip";
}
