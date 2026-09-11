import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { getBaitSpot } from "./bait";
import { getCatch } from "./catches";
import { getAngler, linkedBuddyIds } from "./anglers";
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
import { isCatchVisibleToViewer, planShareRecordId, resolveShareTargets } from "../sharing";
import type { BaitSpot, CalendarNote, CalendarNoteInput, CatchRecord } from "../types";
import { ensureDb } from "./index";
import { allRows, getRow, runChange } from "./query";
import { calendarNotes } from "./schema";
import { clearRecordShares, recordIdsSharedWith, setRecordShares, sharesByRecord } from "./shares";

function nowIso(): string {
  return new Date().toISOString();
}

function mapRow(
  row: typeof calendarNotes.$inferSelect,
  ownerNameById: Map<string, string>,
): CalendarNote {
  const anglerId = row.anglerId;
  return {
    id: row.id,
    anglerId,
    day: row.day,
    title: row.title,
    notes: row.notes,
    placeName: row.placeName,
    speciesTargets: parseSpeciesTargetsJson(row.speciesTargets),
    kind: parseCalendarNoteKind(row.kind),
    sourceCatchId: row.sourceCatchId ?? null,
    sourceBaitId: row.sourceBaitId ?? null,
    photoPath: row.photoPath ?? null,
    sharedWithLinked: Boolean(row.sharedWithLinked),
    sharedWithBuddyIds: [],
    ownerName: ownerNameById.get(anglerId) ?? "Angler",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function ownerNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const id of new Set(ids.filter(Boolean))) {
    const angler = await getAngler(id);
    if (angler) map.set(id, angler.name);
  }
  return map;
}

async function attachPlanShares(notes: CalendarNote[]): Promise<CalendarNote[]> {
  const recordIds = [...new Set(notes.map((note) => planShareRecordId(note.anglerId, note.day)))];
  const shares = await sharesByRecord("plan", recordIds);
  return notes.map((note) => ({
    ...note,
    sharedWithBuddyIds: shares.get(planShareRecordId(note.anglerId, note.day)) ?? [],
  }));
}

async function mapNotes(rows: Array<typeof calendarNotes.$inferSelect>): Promise<CalendarNote[]> {
  const names = await ownerNames(rows.map((row) => row.anglerId));
  return attachPlanShares(rows.map((row) => mapRow(row, names)));
}

async function daySharedWithLinked(anglerId: string, day: string): Promise<boolean> {
  if (!DAY_KEY_RE.test(day)) return false;
  const db = await ensureDb();
  const row = await getRow(
    db
      .select()
      .from(calendarNotes)
      .where(and(eq(calendarNotes.anglerId, anglerId), eq(calendarNotes.day, day))),
  );
  return Boolean(row?.sharedWithLinked);
}

async function clearPlanSharesIfDayEmpty(anglerId: string, day: string): Promise<void> {
  const db = await ensureDb();
  const leftover = await getRow(
    db
      .select()
      .from(calendarNotes)
      .where(and(eq(calendarNotes.anglerId, anglerId), eq(calendarNotes.day, day))),
  );
  if (!leftover) await clearRecordShares("plan", planShareRecordId(anglerId, day));
}

export type ListCalendarNoteOptions = {
  forPlan?: boolean;
  includePlanSpots?: boolean;
  includeShared?: boolean;
  today?: string;
  serverToday?: string;
};

export async function listCalendarNotes(
  viewerId: string,
  options?: ListCalendarNoteOptions,
): Promise<CalendarNote[]> {
  if (options?.forPlan) {
    const today = parseDayKey(options.today);
    if (today) await purgePastPlanNotes(viewerId, today, options.serverToday);
  }
  const includeShared = Boolean(options?.includeShared && options?.forPlan);
  const buddyIds = includeShared ? await linkedBuddyIds(viewerId) : [];
  const ownerIds = includeShared ? [viewerId, ...buddyIds] : [viewerId];
  const db = await ensureDb();
  const rows = await allRows(
    db
      .select()
      .from(calendarNotes)
      .where(
        ownerIds.length === 1
          ? eq(calendarNotes.anglerId, viewerId)
          : inArray(calendarNotes.anglerId, ownerIds),
      )
      .orderBy(asc(calendarNotes.day), asc(calendarNotes.createdAt)),
  );
  const notes = await mapNotes(rows);
  const sharedDays = includeShared ? await recordIdsSharedWith("plan", viewerId) : new Set<string>();
  const visible = notes.filter((note) =>
    isCatchVisibleToViewer({
      anglerId: note.anglerId,
      sharedWithLinked: note.sharedWithLinked,
      viewerId,
      includeShared,
      linkedBuddyIds: buddyIds,
      sharedWithBuddyIds: note.sharedWithBuddyIds,
      sharedWithViewer: sharedDays.has(planShareRecordId(note.anglerId, note.day)),
    }),
  );
  if (options?.forPlan || options?.includePlanSpots) return visible;
  return visible.filter((note) => !isPlanSpotNote(note));
}

/** Source catch/bait rows for Planned thumbs and matching-tide chips — not a journal share. */
export async function planSourceJournalForNotes(notes: CalendarNote[]): Promise<{
  catches: CatchRecord[];
  baitSpots: BaitSpot[];
}> {
  const catchIds = [...new Set(notes.map((note) => note.sourceCatchId).filter(Boolean))] as string[];
  const baitIds = [...new Set(notes.map((note) => note.sourceBaitId).filter(Boolean))] as string[];
  const catches: CatchRecord[] = [];
  const baitSpots: BaitSpot[] = [];
  for (const id of catchIds) {
    const record = await getCatch(id);
    if (record) catches.push(record);
  }
  for (const id of baitIds) {
    const record = await getBaitSpot(id);
    if (record) baitSpots.push(record);
  }
  return { catches, baitSpots };
}

/** Share or unshare one planned day. Does not share journal catches. */
export async function setSharedForPlanDay(args: {
  anglerId: string;
  day: string;
  shared: boolean;
  buddyIds?: string[] | null;
}): Promise<{ updated: number }> {
  if (!DAY_KEY_RE.test(args.day)) return { updated: 0 };
  const db = await ensureDb();
  const rows = await allRows(
    db
      .select()
      .from(calendarNotes)
      .where(and(eq(calendarNotes.anglerId, args.anglerId), eq(calendarNotes.day, args.day))),
  );
  if (!rows.length) return { updated: 0 };
  const linked = await linkedBuddyIds(args.anglerId);
  const target = resolveShareTargets({
    shared: args.shared,
    buddyIds: args.buddyIds,
    linkedBuddyIds: linked,
  });
  await runChange(
    db
      .update(calendarNotes)
      .set({ sharedWithLinked: target.sharedWithLinked ? 1 : 0, updatedAt: nowIso() })
      .where(and(eq(calendarNotes.anglerId, args.anglerId), eq(calendarNotes.day, args.day))),
  );
  const recordId = planShareRecordId(args.anglerId, args.day);
  if (target.buddyIds.length) {
    await setRecordShares({
      kind: "plan",
      recordId,
      ownerId: args.anglerId,
      buddyIds: target.buddyIds,
    });
  } else {
    await clearRecordShares("plan", recordId);
  }
  return { updated: rows.length };
}

/** Clear every calendar note on that Plan day (plan-spots and write-ups). */
export async function deleteCalendarNotesForDay(anglerId: string, day: string): Promise<number> {
  if (!DAY_KEY_RE.test(day)) return 0;
  const db = await ensureDb();
  const deleted = await runChange(
    db
      .delete(calendarNotes)
      .where(and(eq(calendarNotes.anglerId, anglerId), eq(calendarNotes.day, day))),
  );
  await clearRecordShares("plan", planShareRecordId(anglerId, day));
  return deleted;
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
  const stale = await allRows(
    db
      .select()
      .from(calendarNotes)
      .where(and(eq(calendarNotes.anglerId, anglerId), lt(calendarNotes.day, before))),
  );
  const deleted = await runChange(
    db
      .delete(calendarNotes)
      .where(and(eq(calendarNotes.anglerId, anglerId), lt(calendarNotes.day, before))),
  );
  const days = new Set(stale.map((row) => row.day));
  for (const day of days) {
    await clearRecordShares("plan", planShareRecordId(anglerId, day));
  }
  return deleted;
}

export async function getCalendarNote(id: string): Promise<CalendarNote | null> {
  const db = await ensureDb();
  const row = await getRow(db.select().from(calendarNotes).where(eq(calendarNotes.id, id)));
  if (!row) return null;
  const [note] = await mapNotes([row]);
  return note ?? null;
}

export async function createCalendarNote(anglerId: string, input: CalendarNoteInput): Promise<CalendarNote> {
  const db = await ensureDb();
  const id = crypto.randomUUID();
  const stamp = nowIso();
  const speciesTargets = parseSpeciesTargets(input.speciesTargets);
  const sharedWithLinked = await daySharedWithLinked(anglerId, input.day);
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
      sharedWithLinked: sharedWithLinked ? 1 : 0,
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
  await clearPlanSharesIfDayEmpty(anglerId, existing.day);
  return true;
}
