import { parseBaitTypes } from "./bait";
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
/** Short trip name on a Plan day — long enough for “Sharkathon”, short enough for a cell. */
export const PLAN_DAY_LABEL_MAX = 32;
/** Calendar cell copy; longer labels ellipsize. */
export const PLAN_CALENDAR_LABEL_MAX = 10;
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

/**
 * Plan “Remove from plan” targets the calendar note only.
 * Never a catch or bait journal id — those stay in Calendar Log.
 */
export function planSpotRemoveTarget(note: {
  id?: string | null;
  kind?: string | null;
  sourceCatchId?: string | null;
  sourceBaitId?: string | null;
}): { calendarNoteId: string | null; localOnly: boolean } | null {
  if (!isPlanSpotNote(note)) return null;
  const id = note.id?.trim() ?? "";
  if (!id) return null;
  if (id.startsWith("local:")) return { calendarNoteId: null, localOnly: true };
  return { calendarNoteId: id, localOnly: false };
}

/** Calendar Log Planned trips — never includes Plan-only suggested spots. */
export function journalNotesForCalendarLog(notes: CalendarNote[]): CalendarNote[] {
  return notes.filter((note) => !isPlanSpotNote(note));
}

/** Plan Notes list — write-ups only. A title-only row is the day label, not a note. */
export function journalNotesForPlanWriteups(notes: CalendarNote[]): CalendarNote[] {
  return journalNotesForCalendarLog(notes).filter((note) =>
    Boolean(note.notes?.trim() || note.placeName?.trim() || note.speciesTargets.length),
  );
}

/** Journal note that holds this day’s calendar label (title), if any. */
export function planDayLabelNote<T extends { title?: string | null; kind?: string | null }>(
  notes: T[],
): T | null {
  const journal = notes.filter((note) => !isPlanSpotNote(note));
  return journal.find((note) => note.title?.trim()) ?? journal[0] ?? null;
}

/** Explicit Plan day title — never a place name or note body. */
export function planDayLabel(
  notes: Array<{ title?: string | null; kind?: string | null }>,
): string | null {
  for (const note of notes) {
    if (isPlanSpotNote(note)) continue;
    const title = note.title?.trim();
    if (title) return title;
  }
  return null;
}

export function formatPlanCalendarLabel(label: string | null | undefined): string | null {
  const text = label?.trim() ?? "";
  if (!text) return null;
  if (text.length <= PLAN_CALENDAR_LABEL_MAX) return text;
  return `${text.slice(0, PLAN_CALENDAR_LABEL_MAX - 1)}…`;
}

export function labelsByPlanDay(
  notes: Array<{ day: string; title?: string | null; kind?: string | null }>,
): Map<string, string> {
  const byDay = new Map<string, typeof notes>();
  for (const note of notes) {
    const list = byDay.get(note.day) ?? [];
    list.push(note);
    byDay.set(note.day, list);
  }
  const map = new Map<string, string>();
  for (const [day, list] of byDay) {
    const label = planDayLabel(list);
    if (label) map.set(day, label);
  }
  return map;
}

/** Save or clear the Plan day label on a journal note. Null when there is nothing to write. */
export function planDayLabelInput(
  day: string,
  label: string,
  existing?: (Pick<CalendarNote, "notes" | "placeName" | "speciesTargets"> & {
    kind?: CalendarNoteKind | null;
  }) | null,
): CalendarNoteInput | null {
  if (!DAY_KEY_RE.test(day)) return null;
  const title = trimToNull(label, PLAN_DAY_LABEL_MAX);
  const input: CalendarNoteInput = {
    day,
    title,
    notes: existing ? trimToNull(existing.notes, MAX_NOTES) : null,
    placeName: existing?.placeName ?? null,
    speciesTargets: existing?.speciesTargets ?? [],
    kind: JOURNAL_NOTE_KIND,
  };
  return calendarNoteHasContent(input) ? input : null;
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

/** Catch and bait at the same hole are different Planned entries. */
export function planSpotSourceKind(spot: PlanSpotSource): "catch" | "bait" | "place" {
  const sourceCatchId = trimToNull(spot.sourceCatchId ?? spot.catchId, MAX_SOURCE_ID);
  const sourceBaitId = trimToNull(spot.sourceBaitId ?? spot.baitId, MAX_SOURCE_ID);
  if (sourceBaitId && !sourceCatchId) return "bait";
  if (sourceCatchId) return "catch";
  return "place";
}

function planSpotSourceId(spot: PlanSpotSource): string | null {
  const kind = planSpotSourceKind(spot);
  if (kind === "bait") return trimToNull(spot.sourceBaitId ?? spot.baitId, MAX_SOURCE_ID);
  if (kind === "catch") return trimToNull(spot.sourceCatchId ?? spot.catchId, MAX_SOURCE_ID);
  return null;
}

/** One Planned chip / duplicate key: kind + place + catch/bait id when we have one. */
export function planSpotIdentityKey(spot: PlanSpotSource): string | null {
  const place = normalizeNotePlace(spot.placeName);
  if (!place) return null;
  const kind = planSpotSourceKind(spot);
  const sourceId = planSpotSourceId(spot);
  return sourceId ? `${kind}:${place}:${sourceId}` : `${kind}:${place}`;
}

/**
 * Planned chip/row → that bait or catch, even when there is no thumbnail.
 * Photo href is only a fallback for older place-only spots.
 */
export function planSpotDetailHref(
  spot: PlanSpotSource,
  photo?: { href?: string | null } | null,
): string | null {
  const sourceCatchId = trimToNull(spot.sourceCatchId ?? spot.catchId, MAX_SOURCE_ID);
  const sourceBaitId = trimToNull(spot.sourceBaitId ?? spot.baitId, MAX_SOURCE_ID);
  if (sourceBaitId && !sourceCatchId) return `/bait/${sourceBaitId}`;
  if (sourceCatchId) return `/catch/${sourceCatchId}`;
  const href = typeof photo?.href === "string" ? photo.href.trim() : "";
  return href || null;
}

export type PlannedSpotJournal = {
  catches?: Array<{
    id: string;
    species?: string | null;
    speciesList?: string[] | null;
    bait?: string | null;
  }>;
  baitSpots?: Array<{
    id: string;
    baitTypes?: string[] | null;
  }>;
};

export type PlannedSpotLabels = {
  fish: string[];
  bait: string[];
};

function knownFishNames(names: unknown): string[] {
  return parseSpeciesTargets(names).filter((name) => name.toLowerCase() !== "unknown");
}

function fishNamesFromCatch(record?: {
  species?: string | null;
  speciesList?: string[] | null;
}): string[] {
  if (!record) return [];
  const names = record.speciesList?.length
    ? record.speciesList
    : record.species
      ? [record.species]
      : [];
  return knownFishNames(names);
}

/**
 * Fish / bait type labels under a Planned place chip.
 * Prefer the note, then the source catch or bait — never invent names.
 */
export function labelsForPlannedSpot(
  spot: PlanSpotSource,
  journal: PlannedSpotJournal = {},
): PlannedSpotLabels {
  const kind = planSpotSourceKind(spot);
  const sourceCatchId = trimToNull(spot.sourceCatchId ?? spot.catchId, MAX_SOURCE_ID);
  const sourceBaitId = trimToNull(spot.sourceBaitId ?? spot.baitId, MAX_SOURCE_ID);
  const catchRecord = sourceCatchId
    ? journal.catches?.find((record) => record.id === sourceCatchId)
    : undefined;
  const baitRecord = sourceBaitId
    ? journal.baitSpots?.find((record) => record.id === sourceBaitId)
    : undefined;

  const fromNote = knownFishNames(spot.speciesTargets);
  const fish =
    kind === "bait" ? [] : fromNote.length ? fromNote : fishNamesFromCatch(catchRecord);

  const baitFromHole = kind === "bait" ? parseBaitTypes(baitRecord?.baitTypes) : [];
  const baitFromNote = kind === "bait" ? parseBaitTypes(spot.speciesTargets) : [];
  const baitFromCatch =
    kind === "bait" ? [] : parseBaitTypes(catchRecord?.bait ? [catchRecord.bait] : []);
  const bait = baitFromHole.length
    ? baitFromHole
    : baitFromNote.length
      ? baitFromNote
      : baitFromCatch;

  return { fish, bait };
}

export function plannedSpotOpenLabel(
  placeName: string | null | undefined,
  kind: ReturnType<typeof planSpotSourceKind>,
  labels: PlannedSpotLabels,
): string {
  const place = placeName?.trim() || "spot";
  const bits = [place, ...labels.fish, ...labels.bait];
  if (kind === "bait") bits.push("bait");
  else if (kind === "catch") bits.push("catch");
  return bits.join(" ");
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
  notes: Array<
    PlanSpotSource & {
      placeName?: string | null;
      kind?: string | null;
    }
  >,
  placeName?: string | null,
  source?: PlanSpotSource | null,
): boolean {
  const key = normalizeNotePlace(placeName);
  if (!key) return false;
  const want = source ? planSpotSourceKind(source) : null;
  const wantId = source ? planSpotSourceId(source) : null;
  return notes.some((note) => {
    if (!isPlanSpotNote(note) || normalizeNotePlace(note.placeName) !== key) return false;
    if (!want || want === "place") return true;
    if (planSpotSourceKind(note) !== want) return false;
    if (!wantId) return true;
    const haveId = planSpotSourceId(note);
    return !haveId || haveId === wantId;
  });
}

export function plannedSpotsOnDay(notes: CalendarNote[]): CalendarNote[] {
  return notes.filter((note) => isPlanSpotNote(note) && Boolean(note.placeName?.trim()));
}

/** Calendar Log: this day already has Add-to-plan / Plan spots — open Plan, not notes. */
export function calendarDayHasPlan(
  notes: Array<{ kind?: string | null; placeName?: string | null }>,
): boolean {
  return notes.some((note) => isPlanSpotNote(note) && Boolean(note.placeName?.trim()));
}

export function planHrefForDay(day: string): string {
  return `/plan?date=${day}`;
}

/** Build a save payload only when that catch or bait place is not already on the day. */
export function addPlanSpotToDay(
  notes: Array<
    PlanSpotSource & {
      placeName?: string | null;
      kind?: string | null;
    }
  >,
  day: string,
  spot: PlanSpotSource,
): CalendarNoteInput | null {
  const input = planSpotNoteInput(day, spot);
  if (!input || dayHasPlanSpot(notes, input.placeName, spot)) return null;
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
export function mergeListedPlanNotes<T extends { day: string; id?: string }>(
  current: T[],
  listed: T[] | null | undefined,
  today: string,
): T[] {
  if (!Array.isArray(listed)) return upcomingPlanNotes(current, today);
  const next = upcomingPlanNotes(listed, today);
  const keep = upcomingPlanNotes(current, today);
  if (!next.length) return keep.length ? keep : next;
  const listedIds = new Set(next.map((note) => note.id).filter(Boolean));
  const extras = keep.filter((note) => note.id && !listedIds.has(note.id));
  return extras.length ? [...next, ...extras] : next;
}

export type CommittedPlanSpot = PlanSpotSource & {
  day: string;
  placeName: string;
  savedAt?: number;
};

function committedPlanSpotNote(spot: CommittedPlanSpot): CalendarNote {
  const savedAt =
    typeof spot.savedAt === "number" ? new Date(spot.savedAt).toISOString() : new Date().toISOString();
  const source = planSpotSourceFields(spot);
  return {
    id: `local:${spot.day}:${planSpotSourceKind(spot)}:${normalizeNotePlace(spot.placeName)}`,
    anglerId: "",
    day: spot.day,
    title: null,
    notes: null,
    placeName: spot.placeName,
    speciesTargets: parseSpeciesTargets(spot.speciesTargets),
    kind: PLAN_SPOT_NOTE_KIND,
    sourceCatchId: source.sourceCatchId ?? null,
    sourceBaitId: source.sourceBaitId ?? null,
    photoPath: source.photoPath ?? null,
    createdAt: savedAt,
    updatedAt: savedAt,
  };
}

/**
 * Keep a just-saved catch/bait plan-spot visible if a remount refetch is stale.
 * Drop the local copy once the server list already has that source at the place.
 */
export function mergeCommittedPlanSpots(
  notes: CalendarNote[],
  committed: CommittedPlanSpot[] = [],
): CalendarNote[] {
  if (!committed.length) return notes;
  const extras: CalendarNote[] = [];
  for (const spot of committed) {
    const placeName = trimToNull(spot.placeName, MAX_PLACE);
    if (!placeName || !DAY_KEY_RE.test(spot.day)) continue;
    const dayNotes = notes.filter((note) => note.day === spot.day);
    if (dayHasPlanSpot(dayNotes, placeName, spot)) continue;
    extras.push(committedPlanSpotNote({ ...spot, placeName }));
  }
  return extras.length ? [...notes, ...extras] : notes;
}

export type PlannedPlacePhoto = {
  id: string;
  placeName: string;
  src: string;
  href: string;
};

export type PlannedPhotoRecord = {
  id: string;
  placeName?: string | null;
  photoPath?: string | null;
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

function photoFromJournalPlace(
  note: CalendarNote,
  journal: { catches?: PlannedPhotoRecord[]; baitSpots?: PlannedPhotoRecord[] },
): PlannedPlacePhoto | null {
  const placeName = note.placeName?.trim() || "spot";
  const baitOnly = Boolean(note.sourceBaitId && !note.sourceCatchId);

  if (note.sourceCatchId) {
    const byId = journal.catches?.find((record) => record.id === note.sourceCatchId);
    const fromId = photoSrc(byId?.photoPath ?? null);
    if (fromId) return { id: note.id, placeName, src: fromId, href: `/catch/${note.sourceCatchId}` };
  }
  if (baitOnly) {
    const byId = journal.baitSpots?.find((record) => record.id === note.sourceBaitId);
    const fromId = personalPhotoSrc(byId?.photoPath ?? null);
    if (fromId) return { id: note.id, placeName, src: fromId, href: `/bait/${note.sourceBaitId}` };
    return null;
  }

  const key = normalizeNotePlace(note.placeName);
  if (!key) return null;
  if (!note.sourceCatchId) {
    const hit = journal.catches?.find(
      (record) => normalizeNotePlace(record.placeName) === key && photoSrc(record.photoPath ?? null),
    );
    if (hit) {
      const src = photoSrc(hit.photoPath ?? null);
      if (src) return { id: note.id, placeName, src, href: `/catch/${hit.id}` };
    }
  }
  if (note.sourceCatchId || note.sourceBaitId) return null;
  const bait = journal.baitSpots?.find(
    (record) =>
      normalizeNotePlace(record.placeName) === key && personalPhotoSrc(record.photoPath ?? null),
  );
  if (bait) {
    const src = personalPhotoSrc(bait.photoPath ?? null);
    if (src) return { id: note.id, placeName, src, href: `/bait/${bait.id}` };
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
  journal: { catches?: PlannedPhotoRecord[]; baitSpots?: PlannedPhotoRecord[] } = {},
): PlannedPlacePhoto[] {
  const photos: PlannedPlacePhoto[] = [];
  for (const note of spots) {
    const fromSource = photoFromPlanSpotSource(note);
    if (fromSource) {
      photos.push(fromSource);
      continue;
    }
    const fromJournal = photoFromJournalPlace(note, journal);
    if (fromJournal) {
      photos.push(fromJournal);
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
 * Calendar tap → the day the Planned panel should open.
 * Always the tapped YYYY-MM-DD. Never substitutes a different day that
 * already has notes (`restorePlanDay` does that when `/plan` has no date).
 */
export function selectPlanDay(tappedDay: string | null | undefined): string | null {
  return parseDayKey(tappedDay);
}

/**
 * After a calendar tap: notes already on that day, or `[]` so the angler can
 * start a plan there (add a note or a spot). Does not invent another day.
 */
export function planDayAfterSelect<T extends { day: string }>(
  notes: T[],
  tappedDay: string,
): { day: string; notes: T[] } | null {
  const day = selectPlanDay(tappedDay);
  if (!day) return null;
  return { day, notes: planNotesOnDay(notes, day) };
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
  const requested = selectPlanDay(requestedDay);
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
