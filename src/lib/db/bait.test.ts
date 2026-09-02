import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureDefaultAngler } from "./anglers";
import { createBaitSpot, deleteBaitSpot, getBaitSpot, listBaitSpots, updateBaitSpot } from "./bait";
import { getDb, resetDbForTests } from "./index";

describe("bait spots", () => {
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

  it("creates, lists, edits, and deletes a personal bait spot", () => {
    const anglerId = freshDb();
    const created = createBaitSpot({
      baitTypes: ["Shrimp", "Finger mullet"],
      placeName: "Haulover Canal",
      latitude: 28.735,
      longitude: -80.754,
      loggedAt: "2026-08-02T14:00:00.000Z",
      weatherCondition: "clear",
      temperatureF: 84,
      tide: "incoming",
      habitat: "saltwater-inshore",
      anglerId,
    });
    expect(created.baitTypes).toEqual(["Shrimp", "Finger mullet"]);
    expect(created.sharedWithLinked).toBe(false);
    expect(listBaitSpots({ viewerId: anglerId })).toHaveLength(1);

    const edited = updateBaitSpot(created.id, { notes: "Throw net on the flood." });
    expect(edited?.notes).toBe("Throw net on the flood.");

    expect(deleteBaitSpot(created.id)).toBe(true);
    expect(getBaitSpot(created.id)).toBeNull();
  });

  it("hides another angler’s private bait spots", () => {
    const anglerId = freshDb();
    createBaitSpot({
      baitTypes: ["Pogies"],
      placeName: "Secret creek",
      latitude: 28.1,
      longitude: -80.6,
      loggedAt: "2026-08-02T14:00:00.000Z",
      anglerId,
    });
    expect(listBaitSpots({ viewerId: "someone-else", includeShared: true })).toHaveLength(0);
  });
});
