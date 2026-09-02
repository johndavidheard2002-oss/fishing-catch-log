import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCatch, getCatch, listCatches, updateCatch } from "./catches";
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

  it("starts empty until sample catches are loaded on purpose", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();
    expect(listCatches()).toHaveLength(0);
  });

  it("loaded sample July 12 keeps Pace Bend and the main-lake point as two pins", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    const db = getDb();
    loadSampleCatches(db, ensureDefaultAngler().id);

    const dawn = listCatches().find((c) => c.placeName?.includes("Pace Bend"));
    const afternoon = listCatches().find(
      (c) => c.placeName === "Lake Travis, TX" && c.caughtAt.startsWith("2025-07-12"),
    );
    expect(dawn?.latitude).toBe(30.458);
    expect(afternoon?.latitude).toBe(30.388);
    expect(dawn?.longitude).not.toBe(afternoon?.longitude);
  });

  it("editing one same-day catch pin does not move the other", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();

    const a = createCatch({
      species: "Largemouth Bass",
      latitude: 30.458,
      longitude: -98.012,
      placeName: "Pace Bend, Lake Travis, TX",
      caughtAt: "2025-07-12T12:15:00.000Z",
    });
    const b = createCatch({
      species: "Largemouth Bass",
      latitude: 30.388,
      longitude: -97.975,
      placeName: "Lake Travis, TX",
      caughtAt: "2025-07-12T20:40:00.000Z",
    });

    const moved = updateCatch(a.id, {
      latitude: 31.2,
      longitude: -97.1,
      placeName: "Moved hole",
    });
    expect(moved?.placeName).toBe("Moved hole");
    expect(moved?.latitude).toBe(31.2);

    const other = getCatch(b.id);
    expect(other?.placeName).toBe("Lake Travis, TX");
    expect(other?.latitude).toBe(30.388);
    expect(other?.longitude).toBe(-97.975);
  });
});
