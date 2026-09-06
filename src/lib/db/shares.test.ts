import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAngler, linkAnglers } from "./anglers";
import { createCatch, listCatches, setSharedForCatchIds } from "./catches";
import { resetDbForTests } from "./index";

describe("selective spot shares", () => {
  const previousPath = process.env.DATABASE_PATH;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  it("lets person 1 see spot A and hides it from person 2", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-share-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();

    const owner = await createAngler("Owner");
    const sam = await createAngler("Sam");
    const pat = await createAngler("Pat");
    await linkAnglers(owner.id, sam.id);
    await linkAnglers(owner.id, pat.id);

    const spotA = await createCatch({
      species: "Redfish",
      speciesList: ["Redfish"],
      caughtAt: "2026-09-02T12:00:00.000Z",
      habitat: "saltwater-inshore",
      latitude: 28.74,
      longitude: -80.75,
      placeName: "Spot A",
      anglerId: owner.id,
    });
    const spotB = await createCatch({
      species: "Snook",
      speciesList: ["Snook"],
      caughtAt: "2026-09-02T13:00:00.000Z",
      habitat: "saltwater-inshore",
      latitude: 28.75,
      longitude: -80.76,
      placeName: "Spot B",
      anglerId: owner.id,
    });

    await setSharedForCatchIds({
      anglerId: owner.id,
      ids: [spotA.id],
      shared: true,
      buddyIds: [sam.id],
    });
    await setSharedForCatchIds({
      anglerId: owner.id,
      ids: [spotB.id],
      shared: true,
      buddyIds: [pat.id],
    });

    const samSees = await listCatches({ viewerId: sam.id, includeShared: true });
    const patSees = await listCatches({ viewerId: pat.id, includeShared: true });
    expect(samSees.map((row) => row.placeName)).toEqual(["Spot A"]);
    expect(patSees.map((row) => row.placeName)).toEqual(["Spot B"]);
    expect(samSees.some((row) => row.placeName === "Spot B")).toBe(false);
    expect(patSees.some((row) => row.placeName === "Spot A")).toBe(false);
  });
});
