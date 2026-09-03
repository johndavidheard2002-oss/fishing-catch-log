import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCatch, getCatch, listCatches, setSharedForCatchIds, setSharedForDay, updateCatch } from "./catches";
import { getDb, resetDbForTests } from "./index";
import { loadSampleCatches } from "./seed";
import { ensureDefaultAngler } from "./anglers";

describe("same-day catch locations stay independent", () => {
  const previousPath = process.env.DATABASE_PATH;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  it("starts empty until sample catches are loaded on purpose", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();
    expect(await listCatches()).toHaveLength(0);
  });

  it("loaded sample July 12 keeps Pace Bend and the main-lake point as two pins", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    const db = getDb();
    await loadSampleCatches(db, ensureDefaultAngler().id);

    const listed = await listCatches();
    const dawn = listed.find((c) => c.placeName?.includes("Pace Bend"));
    const afternoon = listed.find(
      (c) => c.placeName === "Lake Travis, TX" && c.caughtAt.startsWith("2025-07-12"),
    );
    expect(dawn?.latitude).toBe(30.458);
    expect(afternoon?.latitude).toBe(30.388);
    expect(dawn?.longitude).not.toBe(afternoon?.longitude);
  });

  it("editing one same-day catch pin does not move the other", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();

    const a = await createCatch({
      species: "Largemouth Bass",
      latitude: 30.458,
      longitude: -98.012,
      placeName: "Pace Bend, Lake Travis, TX",
      caughtAt: "2025-07-12T12:15:00.000Z",
    });
    const b = await createCatch({
      species: "Largemouth Bass",
      latitude: 30.388,
      longitude: -97.975,
      placeName: "Lake Travis, TX",
      caughtAt: "2025-07-12T20:40:00.000Z",
    });

    const moved = await updateCatch(a.id, {
      latitude: 31.2,
      longitude: -97.1,
      placeName: "Moved hole",
    });
    expect(moved?.placeName).toBe("Moved hole");
    expect(moved?.latitude).toBe(31.2);

    const other = await getCatch(b.id);
    expect(other?.placeName).toBe("Lake Travis, TX");
    expect(other?.latitude).toBe(30.388);
    expect(other?.longitude).toBe(-97.975);
  });
});

describe("setSharedForDay", () => {
  const previousPath = process.env.DATABASE_PATH;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  it("shares every catch on that local day and leaves other days private", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();
    const owner = ensureDefaultAngler().id;
    const sameDawn = await createCatch({
      species: "Redfish",
      caughtAt: new Date(2025, 6, 12, 8, 10).toISOString(),
      anglerId: owner,
    });
    const sameDusk = await createCatch({
      species: "Snook",
      caughtAt: new Date(2025, 6, 12, 18, 40).toISOString(),
      anglerId: owner,
    });
    const otherDay = await createCatch({
      species: "Tarpon",
      caughtAt: new Date(2025, 6, 13, 12, 0).toISOString(),
      anglerId: owner,
    });
    expect((await setSharedForDay({ anglerId: owner, day: "2025-07-12", shared: true })).updated).toBe(2);
    expect((await getCatch(sameDawn.id))?.sharedWithLinked).toBe(true);
    expect((await getCatch(sameDusk.id))?.sharedWithLinked).toBe(true);
    expect((await getCatch(otherDay.id))?.sharedWithLinked).toBe(false);
    expect((await setSharedForDay({ anglerId: owner, day: "2025-07-12", shared: false })).updated).toBe(2);
    expect((await getCatch(sameDawn.id))?.sharedWithLinked).toBe(false);
  });

  it("shares only the owner’s selected catch ids", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();
    const owner = ensureDefaultAngler().id;
    const keep = await createCatch({
      species: "Redfish",
      caughtAt: new Date(2025, 6, 12, 8, 10).toISOString(),
      anglerId: owner,
    });
    const skip = await createCatch({
      species: "Snook",
      caughtAt: new Date(2025, 6, 12, 18, 40).toISOString(),
      anglerId: owner,
    });
    expect(
      (await setSharedForCatchIds({ anglerId: owner, ids: [keep.id, "not-mine"], shared: true })).updated,
    ).toBe(1);
    expect((await getCatch(keep.id))?.sharedWithLinked).toBe(true);
    expect((await getCatch(skip.id))?.sharedWithLinked).toBe(false);
  });
});
