import { and, asc, eq, lt } from "drizzle-orm";
import {
  calendarNoteHasContent,
  DAY_KEY_RE,
  isPlanSpotNote,
  parseCalendarNoteKind,
  parseDayKey,
  parseSpeciesTargets,
  parseSpeciesTargetsJson,
  safePlanDayPurgeBeforeKey,
  utcTodayKey,
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
    kind: parseCalendarNoteKind(row.kind),
    sourceCatchId: row.sourceCatchId ?? null,
    sourceBaitId: row.sourceBaitId ?? null,
    photoPath: row.photoPath ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listCalendarNotes(
  anglerId: string,
  options?: { forPlan?: boolean; includePlanSpots?: boolean; today?: string; serverToday?: string },
): Promise<CalendarNote[]> {
  if (options?.forPlan) {
    const today = parseDayKey(options.today);
    if (today) await purgePastPlanNotes(anglerId, today, options.serverToday);
  }
  const db = await ensureDb();
  const rows = await allRows(
    db
      .select()
      .from(calendarNotes)
      .where(eq(calendarNotes.anglerId, anglerId))
      .orderBy(asc(calendarNotes.day), asc(calendarNotes.createdAt)),
  );
  const notes = rows.map(mapRow);
  if (options?.forPlan || options?.includePlanSpots) return notes;
  return notes.filter((note) => !isPlanSpotNote(note));
}

/** Clear every calendar note on that Plan day (plan-spots and write-ups). */
export async function deleteCalendarNotesForDay(anglerId: string, day: string): Promise<number> {
  if (!DAY_KEY_RE.test(day)) return 0;
  const db = await ensureDb();
  return runChange(
    db
      .delete(calendarNotes)
      .where(and(eq(calendarNotes.anglerId, anglerId), eq(calendarNotes.day, day))),
  );
}

/** Drop plan-spot and plan-day notes 3+ local days after their plan day. */
export async function purgePastPlanNotes(
  anglerId: string,
  today: string,
  serverToday?: string,
): Promise<number> {
  const before = safePlanDayPurgeBeforeKey(today, parseDayKey(serverToday) ?? utcTodayKey());
  if (!before) return 0;
  const db = await ensureDb();
  return runChange(
    db
      .delete(calendarNotes)
      .where(and(eq(calendarNotes.anglerId, anglerId), lt(calendarNotes.day, before))),
  );
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
      kind: parseCalendarNoteKind(input.kind),
      sourceCatchId: input.sourceCatchId ?? null,
      sourceBaitId: input.sourceBaitId ?? null,
      photoPath: input.photoPath ?? null,
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
        kind: parseCalendarNoteKind(input.kind ?? existing.kind),
        sourceCatchId:
          input.sourceCatchId !== undefined ? input.sourceCatchId : existing.sourceCatchId,
        sourceBaitId: input.sourceBaitId !== undefined ? input.sourceBaitId : existing.sourceBaitId,
        photoPath: input.photoPath !== undefined ? input.photoPath : existing.photoPath,
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
