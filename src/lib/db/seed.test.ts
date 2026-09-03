import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCatch, listCatches } from "./catches";
import { getDb, resetDbForTests } from "./index";
import { ensureDefaultAngler } from "./anglers";
import { countSampleCatches, loadSampleCatches, removeSampleCatches } from "./seed";

describe("sample catches are opt-in", () => {
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
    return getDb();
  }

  it("does not insert sample trips on first launch", async () => {
    freshDb();
    expect(await listCatches()).toHaveLength(0);
    expect(await countSampleCatches(getDb())).toBe(0);
  });

  it("load inserts samples once and remove deletes only those", async () => {
    const db = freshDb();
    const owner = ensureDefaultAngler().id;
    await createCatch({
      species: "Redfish",
      latitude: 28.74,
      longitude: -80.75,
      placeName: "My hole",
      caughtAt: "2026-08-01T14:00:00.000Z",
      photoPath: "user-one.jpg",
    });
    const first = await loadSampleCatches(db, owner);
    expect(first.inserted).toBeGreaterThan(1);
    expect((await loadSampleCatches(db, owner)).inserted).toBe(0);
    const afterLoad = await listCatches();
    expect(afterLoad.some((c) => c.placeName === "My hole")).toBe(true);
    expect(afterLoad.some((c) => c.photoPath?.startsWith("/seed/"))).toBe(true);

    const removed = await removeSampleCatches(db);
    expect(removed).toBe(first.inserted);
    const left = await listCatches();
    expect(left).toHaveLength(1);
    expect(left[0].placeName).toBe("My hole");
    expect(left[0].photoPath).toBe("user-one.jpg");
  });
});
