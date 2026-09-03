import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureDefaultAngler } from "./anglers";
import { createCatch } from "./catches";
import { getDb, resetDbForTests } from "./index";
import { listNamedAreas, upsertNamedArea } from "./areas";
import { createBaitSpot } from "./bait";

describe("named areas", () => {
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

  it("upserts by case-insensitive name and lists catch place names as options", async () => {
    const anglerId = freshDb();
    const saved = await upsertNamedArea(anglerId, {
      name: "Mosquito Lagoon",
      latitude: 28.74,
      longitude: -80.75,
    });
    const again = await upsertNamedArea(anglerId, {
      name: "mosquito lagoon",
      latitude: 28.741,
      longitude: -80.751,
    });
    expect(again.id).toBe(saved.id);
    expect(again.latitude).toBe(28.741);

    await createCatch({
      species: "Redfish",
      placeName: "Haulover Canal",
      latitude: 28.735,
      longitude: -80.754,
      caughtAt: "2026-08-02T15:00:00.000Z",
      habitat: "saltwater-inshore",
      anglerId,
    });

    const listed = await listNamedAreas(anglerId);
    expect(listed.map((a) => a.name)).toEqual(
      expect.arrayContaining(["mosquito lagoon", "Haulover Canal"]),
    );
    const haulover = listed.find((a) => a.name === "Haulover Canal");
    expect(haulover?.source).toBe("saved");
    expect(haulover?.latitude).toBe(28.735);
  });

  it("includes bait-spot area names in the option list", async () => {
    const anglerId = freshDb();
    await createBaitSpot({
      baitTypes: ["Shrimp"],
      placeName: "The shrimp hole",
      latitude: 28.7,
      longitude: -80.7,
      loggedAt: "2026-08-02T12:00:00.000Z",
      habitat: "saltwater-inshore",
      anglerId,
    });
    const listed = await listNamedAreas(anglerId);
    expect(listed.some((a) => a.name === "The shrimp hole")).toBe(true);
  });
});
