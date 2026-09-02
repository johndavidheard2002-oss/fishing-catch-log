import { and, asc, eq } from "drizzle-orm";
import {
  calendarNoteHasContent,
  parseSpeciesTargets,
  parseSpeciesTargetsJson,
} from "../notes";
import type { CalendarNote, CalendarNoteInput } from "../types";
import { getDb } from "./index";
import { calendarNotes } from "./schema";

function nowIso(): string {
  return new Date().toISOString();
}

function mapRow(row: typeof calendarNotes.$inferSelect): CalendarNote {
  return {
    id: row.id,
    anglerId: row.anglerId,
    day: row.day,
    title: row.title,
    notes: row.notes,
    placeName: row.placeName,
    speciesTargets: parseSpeciesTargetsJson(row.speciesTargets),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listCalendarNotes(anglerId: string): CalendarNote[] {
  const db = getDb();
  const rows = db
    .select()
    .from(calendarNotes)
    .where(eq(calendarNotes.anglerId, anglerId))
    .orderBy(asc(calendarNotes.day), asc(calendarNotes.createdAt))
    .all();
  return rows.map(mapRow);
}

export function getCalendarNote(id: string): CalendarNote | null {
  const db = getDb();
  const row = db.select().from(calendarNotes).where(eq(calendarNotes.id, id)).get();
  return row ? mapRow(row) : null;
}

export function createCalendarNote(anglerId: string, input: CalendarNoteInput): CalendarNote {
  const db = getDb();
  const id = crypto.randomUUID();
  const stamp = nowIso();
  const speciesTargets = parseSpeciesTargets(input.speciesTargets);
  db.insert(calendarNotes)
    .values({
      id,
      anglerId,
      day: input.day,
      title: input.title ?? null,
      notes: input.notes ?? null,
      placeName: input.placeName ?? null,
      speciesTargets: JSON.stringify(speciesTargets),
      createdAt: stamp,
      updatedAt: stamp,
    })
    .run();
  return getCalendarNote(id)!;
}

export function updateCalendarNote(
  id: string,
  anglerId: string,
  input: CalendarNoteInput,
): CalendarNote | null {
  const existing = getCalendarNote(id);
  if (!existing || existing.anglerId !== anglerId) return null;
  if (!calendarNoteHasContent(input)) return null;
  const db = getDb();
  const speciesTargets = parseSpeciesTargets(input.speciesTargets);
  db.update(calendarNotes)
    .set({
      day: input.day,
      title: input.title ?? null,
      notes: input.notes ?? null,
      placeName: input.placeName ?? null,
      speciesTargets: JSON.stringify(speciesTargets),
      updatedAt: nowIso(),
    })
    .where(and(eq(calendarNotes.id, id), eq(calendarNotes.anglerId, anglerId)))
    .run();
  return getCalendarNote(id);
}

export function deleteCalendarNote(id: string, anglerId: string): boolean {
  const existing = getCalendarNote(id);
  if (!existing || existing.anglerId !== anglerId) return false;
  const db = getDb();
  db.delete(calendarNotes)
    .where(and(eq(calendarNotes.id, id), eq(calendarNotes.anglerId, anglerId)))
    .run();
  return true;
}
