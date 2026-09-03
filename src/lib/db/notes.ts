import { and, asc, eq } from "drizzle-orm";
import {
  calendarNoteHasContent,
  parseSpeciesTargets,
  parseSpeciesTargetsJson,
} from "../notes";
import type { CalendarNote, CalendarNoteInput } from "../types";
import { ensureDb } from "./index";
import { allRows, getRow, runChange } from "./query";
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

export async function listCalendarNotes(anglerId: string): Promise<CalendarNote[]> {
  const db = await ensureDb();
  const rows = await allRows(
    db
      .select()
      .from(calendarNotes)
      .where(eq(calendarNotes.anglerId, anglerId))
      .orderBy(asc(calendarNotes.day), asc(calendarNotes.createdAt)),
  );
  return rows.map(mapRow);
}

export async function getCalendarNote(id: string): Promise<CalendarNote | null> {
  const db = await ensureDb();
  const row = await getRow(db.select().from(calendarNotes).where(eq(calendarNotes.id, id)));
  return row ? mapRow(row) : null;
}

export async function createCalendarNote(anglerId: string, input: CalendarNoteInput): Promise<CalendarNote> {
  const db = await ensureDb();
  const id = crypto.randomUUID();
  const stamp = nowIso();
  const speciesTargets = parseSpeciesTargets(input.speciesTargets);
  await runChange(
    db.insert(calendarNotes).values({
      id,
      anglerId,
      day: input.day,
      title: input.title ?? null,
      notes: input.notes ?? null,
      placeName: input.placeName ?? null,
      speciesTargets: JSON.stringify(speciesTargets),
      createdAt: stamp,
      updatedAt: stamp,
    }),
  );
  return (await getCalendarNote(id))!;
}

export async function updateCalendarNote(
  id: string,
  anglerId: string,
  input: CalendarNoteInput,
): Promise<CalendarNote | null> {
  const existing = await getCalendarNote(id);
  if (!existing || existing.anglerId !== anglerId) return null;
  if (!calendarNoteHasContent(input)) return null;
  const db = await ensureDb();
  const speciesTargets = parseSpeciesTargets(input.speciesTargets);
  await runChange(
    db
      .update(calendarNotes)
      .set({
        day: input.day,
        title: input.title ?? null,
        notes: input.notes ?? null,
        placeName: input.placeName ?? null,
        speciesTargets: JSON.stringify(speciesTargets),
        updatedAt: nowIso(),
      })
      .where(and(eq(calendarNotes.id, id), eq(calendarNotes.anglerId, anglerId))),
  );
  return getCalendarNote(id);
}

export async function deleteCalendarNote(id: string, anglerId: string): Promise<boolean> {
  const existing = await getCalendarNote(id);
  if (!existing || existing.anglerId !== anglerId) return false;
  const db = await ensureDb();
  await runChange(
    db.delete(calendarNotes).where(and(eq(calendarNotes.id, id), eq(calendarNotes.anglerId, anglerId))),
  );
  return true;
}
