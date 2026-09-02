import { describe, expect, it } from "vitest";
import { clampFishCount, fishCountLabel, speciesCountLine, speciesFishCounts } from "./count";
import { catchOf } from "./testing";

describe("clampFishCount", () => {
  it("defaults to the tagged-species count when empty", () => {
    expect(clampFishCount(null)).toBe(1);
    expect(clampFishCount(undefined, 2)).toBe(2);
    expect(clampFishCount("0", 3)).toBe(3);
  });

  it("clamps to 1–99 and never below species count", () => {
    expect(clampFishCount(4, 2)).toBe(4);
    expect(clampFishCount(1, 3)).toBe(3);
    expect(clampFishCount(200)).toBe(99);
  });
});

describe("fishCountLabel", () => {
  it("pluralizes", () => {
    expect(fishCountLabel(1)).toBe("1 fish");
    expect(fishCountLabel(4)).toBe("4 fish");
  });
});

describe("speciesFishCounts", () => {
  it("sums one species across trips at a spot", () => {
    const rows = speciesFishCounts([
      catchOf({ id: "a", fishCount: 2 }),
      catchOf({ id: "b", fishCount: 3, caughtAt: "2025-07-13T11:00:00.000Z" }),
    ]);
    expect(rows).toEqual([{ species: "Largemouth Bass", count: 5 }]);
  });

  it("splits a mixed photo across tagged species", () => {
    const rows = speciesFishCounts([
      catchOf({
        id: "mix",
        species: "Redfish",
        speciesList: ["Redfish", "Speckled Trout"],
        fishCount: 2,
      }),
    ]);
    expect(rows).toEqual([
      { species: "Redfish", count: 1 },
      { species: "Speckled Trout", count: 1 },
    ]);
    expect(speciesCountLine(rows)).toBe("Redfish 1 · Speckled Trout 1");
  });

  it("gives leftover fish to the first tagged species", () => {
    const rows = speciesFishCounts([
      catchOf({
        id: "mix",
        species: "Redfish",
        speciesList: ["Redfish", "Speckled Trout"],
        fishCount: 5,
      }),
    ]);
    expect(rows).toEqual([
      { species: "Redfish", count: 3 },
      { species: "Speckled Trout", count: 2 },
    ]);
  });
});
