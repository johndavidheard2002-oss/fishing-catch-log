import type { CalendarNote, CalendarNoteInput, CalendarNoteKind } from "./types";

export const JOURNAL_NOTE_KIND: CalendarNoteKind = "journal";
export const PLAN_SPOT_NOTE_KIND: CalendarNoteKind = "plan-spot";

export const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_TITLE = 80;
const MAX_NOTES = 2000;
const MAX_PLACE = 120;
const MAX_SPECIES = 8;

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
  existing?: Pick<CalendarNote, "title" | "placeName" | "speciesTargets" | "kind"> | null,
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

/** Suggested Plan spot → a calendar note that pins that place onto the day. */
export function planSpotNoteInput(
  day: string,
  spot: { placeName?: string | null; speciesTargets?: string[] | null },
): CalendarNoteInput | null {
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
  spot: { placeName?: string | null; speciesTargets?: string[] | null },
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
  const input: CalendarNoteInput = { day, title, notes, placeName, speciesTargets, kind };
  if (!calendarNoteHasContent(input)) return null;
  return input;
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
