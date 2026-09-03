import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureDefaultAngler } from "./anglers";
import { createBaitSpot, deleteBaitSpot, getBaitSpot, listBaitSpots, setSharedForBaitIds, updateBaitSpot } from "./bait";
import { setSharedForDay } from "./catches";
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

  it("creates, lists, edits, and deletes a personal bait spot", async () => {
    const anglerId = freshDb();
    const created = await createBaitSpot({
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
    expect(await listBaitSpots({ viewerId: anglerId })).toHaveLength(1);

    const edited = await updateBaitSpot(created.id, { notes: "Throw net on the flood." });
    expect(edited?.notes).toBe("Throw net on the flood.");

    expect(await deleteBaitSpot(created.id)).toBe(true);
    expect(await getBaitSpot(created.id)).toBeNull();
  });

  it("hides another angler’s private bait spots", async () => {
    const anglerId = freshDb();
    await createBaitSpot({
      baitTypes: ["Pogies"],
      placeName: "Secret creek",
      latitude: 28.1,
      longitude: -80.6,
      loggedAt: "2026-08-02T14:00:00.000Z",
      anglerId,
    });
    expect(await listBaitSpots({ viewerId: "someone-else", includeShared: true })).toHaveLength(0);
  });

  it("shares only the owner’s bait holes", async () => {
    const anglerId = freshDb();
    const mine = await createBaitSpot({
      baitTypes: ["Shrimp"],
      placeName: "Canal",
      latitude: 28.735,
      longitude: -80.754,
      loggedAt: "2026-08-02T14:00:00.000Z",
      anglerId,
    });
    const other = await createBaitSpot({
      baitTypes: ["Mullet"],
      placeName: "Creek",
      latitude: 28.1,
      longitude: -80.6,
      loggedAt: "2026-08-02T15:00:00.000Z",
      anglerId,
    });
    expect(
      (await setSharedForBaitIds({ anglerId, ids: [mine.id, "missing"], shared: true })).updated,
    ).toBe(1);
    expect((await getBaitSpot(mine.id))?.sharedWithLinked).toBe(true);
    expect((await getBaitSpot(other.id))?.sharedWithLinked).toBe(false);
  });

  it("setSharedForDay shares bait logged on that calendar day", async () => {
    const anglerId = freshDb();
    const onDay = await createBaitSpot({
      baitTypes: ["Shrimp"],
      placeName: "Canal",
      latitude: 28.735,
      longitude: -80.754,
      loggedAt: new Date(2026, 7, 2, 10, 0).toISOString(),
      anglerId,
    });
    const otherDay = await createBaitSpot({
      baitTypes: ["Mullet"],
      placeName: "Creek",
      latitude: 28.1,
      longitude: -80.6,
      loggedAt: new Date(2026, 7, 3, 10, 0).toISOString(),
      anglerId,
    });
    expect((await setSharedForDay({ anglerId, day: "2026-08-02", shared: true })).updated).toBe(1);
    expect((await getBaitSpot(onDay.id))?.sharedWithLinked).toBe(true);
    expect((await getBaitSpot(otherDay.id))?.sharedWithLinked).toBe(false);
  });
});
