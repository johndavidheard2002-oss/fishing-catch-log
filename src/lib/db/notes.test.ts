import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureDefaultAngler } from "./anglers";
import { getDb, resetDbForTests } from "./index";
import {
  createCalendarNote,
  deleteCalendarNote,
  getCalendarNote,
  listCalendarNotes,
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
});
