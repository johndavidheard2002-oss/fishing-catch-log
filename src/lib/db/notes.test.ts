import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureDefaultAngler } from "./anglers";
import { getDb, resetDbForTests } from "./index";
import { addPlanSpotToDay } from "../notes";
import { createCatch, listCatches } from "./catches";
import {
  createCalendarNote,
  deleteCalendarNote,
  deleteCalendarNotesForDay,
  getCalendarNote,
  listCalendarNotes,
  purgePastPlanNotes,
  updateCalendarNote,
} from "./notes";

describe("calendar notes", () => {
  const previousPath = process.env.DATABASE_PATH;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  function freshDb() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();
    return ensureDefaultAngler().id;
  }

  it("creates, lists, edits, and deletes a planned trip on a day", async () => {
    const anglerId = freshDb();
    const created = await createCalendarNote(anglerId, {
      day: "2026-09-10",
      title: "Dawn flood",
      notes: "Outgoing at the point.",
      placeName: "Mosquito Lagoon",
      speciesTargets: ["Redfish", "Snook"],
    });
    expect(created.day).toBe("2026-09-10");
    expect(created.speciesTargets).toEqual(["Redfish", "Snook"]);
    expect(await listCalendarNotes(anglerId)).toHaveLength(1);

    const edited = await updateCalendarNote(created.id, anglerId, {
      day: "2026-09-10",
      title: "Dawn flood",
      notes: "Wind east 10.",
      placeName: "Mosquito Lagoon",
      speciesTargets: ["Redfish"],
    });
    expect(edited?.notes).toBe("Wind east 10.");
    expect(edited?.speciesTargets).toEqual(["Redfish"]);

    expect(await deleteCalendarNote(created.id, anglerId)).toBe(true);
    expect(await getCalendarNote(created.id)).toBeNull();
    expect(await listCalendarNotes(anglerId)).toEqual([]);
  });

  it("adds a suggested Plan spot onto that calendar day", async () => {
    const anglerId = freshDb();
    const input = addPlanSpotToDay([], "2026-09-10", {
      placeName: "Haulover Canal",
      speciesTargets: ["Redfish"],
    });
    expect(input).not.toBeNull();
    const created = await createCalendarNote(anglerId, input!);
    expect(created.day).toBe("2026-09-10");
    expect(created.placeName).toBe("Haulover Canal");
    expect(created.speciesTargets).toEqual(["Redfish"]);
    expect(created.kind).toBe("plan-spot");
    expect(await listCalendarNotes(anglerId)).toEqual([]);
    const onPlan = await listCalendarNotes(anglerId, { forPlan: true });
    expect(onPlan.map((note) => note.placeName)).toEqual(["Haulover Canal"]);
    expect(addPlanSpotToDay(onPlan, "2026-09-10", { placeName: "Haulover Canal" })).toBeNull();
  });

  it("keeps a journal planned trip on Calendar Log while hiding Plan-day spots", async () => {
    const anglerId = freshDb();
    await createCalendarNote(anglerId, {
      day: "2026-09-10",
      title: "Dawn flood",
      placeName: "The point",
    });
    await createCalendarNote(anglerId, {
      day: "2026-09-10",
      placeName: "Haulover Canal",
      kind: "plan-spot",
    });
    const calendarLog = await listCalendarNotes(anglerId);
    expect(calendarLog.map((note) => note.placeName)).toEqual(["The point"]);
    expect(calendarLog.every((note) => note.kind === "journal")).toBe(true);
    const planDay = await listCalendarNotes(anglerId, { forPlan: true });
    expect(planDay.map((note) => note.placeName)).toEqual(["The point", "Haulover Canal"]);
  });

  it("does not let another angler edit or delete the note", async () => {
    const anglerId = freshDb();
    const created = await createCalendarNote(anglerId, {
      day: "2026-09-12",
      title: "Private plan",
    });
    expect(
      await updateCalendarNote(created.id, "someone-else", { day: "2026-09-12", title: "Nope" }),
    ).toBe(null);
    expect(await deleteCalendarNote(created.id, "someone-else")).toBe(false);
    expect((await getCalendarNote(created.id))?.title).toBe("Private plan");
  });

  it("deletes every plan-spot and write-up on the selected day", async () => {
    const anglerId = freshDb();
    await createCalendarNote(anglerId, {
      day: "2026-09-10",
      notes: "Try the north shoreline.",
    });
    await createCalendarNote(anglerId, {
      day: "2026-09-10",
      placeName: "Haulover Canal",
      kind: "plan-spot",
    });
    const keep = await createCalendarNote(anglerId, {
      day: "2026-09-11",
      notes: "Keep tomorrow.",
    });
    expect(await deleteCalendarNotesForDay(anglerId, "2026-09-10")).toBe(2);
    const remaining = await listCalendarNotes(anglerId, { forPlan: true });
    expect(remaining.map((note) => note.id)).toEqual([keep.id]);
  });

  it("does not let another angler clear this day’s plan", async () => {
    const anglerId = freshDb();
    const created = await createCalendarNote(anglerId, {
      day: "2026-09-12",
      title: "Private plan",
    });
    expect(await deleteCalendarNotesForDay("someone-else", "2026-09-12")).toBe(0);
    expect((await getCalendarNote(created.id))?.title).toBe("Private plan");
  });

  it("purges Plan days 3+ days old when listing for Plan, and leaves grace days, today, future, and journal catches", async () => {
    const anglerId = freshDb();
    await createCalendarNote(anglerId, {
      day: "2026-09-06",
      placeName: "Haulover Canal",
      kind: "plan-spot",
    });
    await createCalendarNote(anglerId, {
      day: "2026-09-07",
      notes: "Three days back — clear it.",
    });
    const graceSpot = await createCalendarNote(anglerId, {
      day: "2026-09-08",
      placeName: "Farm Pond",
      kind: "plan-spot",
    });
    const yesterdayNote = await createCalendarNote(anglerId, {
      day: "2026-09-09",
      notes: "Still within the grace window.",
    });
    const todaySpot = await createCalendarNote(anglerId, {
      day: "2026-09-10",
      placeName: "The point",
      kind: "plan-spot",
    });
    const tomorrowNote = await createCalendarNote(anglerId, {
      day: "2026-09-11",
      notes: "Dawn outgoing.",
    });
    const otherExpired = await createCalendarNote("someone-else", {
      day: "2026-09-06",
      notes: "Not this angler.",
    });
    const loggedCatch = await createCatch({
      species: "Redfish",
      placeName: "Haulover Canal",
      caughtAt: "2026-09-06T15:00:00.000Z",
      habitat: "saltwater-inshore",
      anglerId,
    });

    expect(await purgePastPlanNotes(anglerId, "nope")).toBe(0);
    const onPlan = await listCalendarNotes(anglerId, { forPlan: true, today: "2026-09-10" });
    expect(onPlan.map((note) => note.id).sort()).toEqual(
      [graceSpot.id, yesterdayNote.id, todaySpot.id, tomorrowNote.id].sort(),
    );
    expect(await getCalendarNote(otherExpired.id)).not.toBeNull();
    const calendarLog = await listCalendarNotes(anglerId);
    expect(calendarLog.map((note) => note.id)).toEqual([yesterdayNote.id, tomorrowNote.id]);
    const catches = await listCatches();
    expect(catches.map((record) => record.id)).toEqual([loggedCatch.id]);
    expect(catches[0]?.placeName).toBe("Haulover Canal");
  });

  it("leaves expired Plan notes in place when Calendar Log lists without forPlan", async () => {
    const anglerId = freshDb();
    const expired = await createCalendarNote(anglerId, {
      day: "2026-09-06",
      notes: "Still on Calendar Log until Plan loads.",
    });
    const listed = await listCalendarNotes(anglerId, { today: "2026-09-10" });
    expect(listed.map((note) => note.id)).toEqual([expired.id]);
    expect(await getCalendarNote(expired.id)).not.toBeNull();
  });
});
