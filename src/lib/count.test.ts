import { describe, expect, it } from "vitest";
import {
  alignCountDrafts,
  catchFishLabel,
  catchSpeciesTitle,
  clampFishCount,
  countsForCatch,
  countsFromDrafts,
  draftFishCountForSpecies,
  fishCountLabel,
  normalizeSpeciesCounts,
  resolveCatchCounts,
  sanitizeFishCountDraft,
  speciesCountLine,
  speciesFishCounts,
} from "./count";
import { catchOf } from "./testing";

describe("clampFishCount", () => {
  it("defaults to 1 when empty", () => {
    expect(clampFishCount(null)).toBe(1);
    expect(clampFishCount(undefined)).toBe(1);
    expect(clampFishCount("0")).toBe(1);
  });

  it("clamps each count to 1–99", () => {
    expect(clampFishCount(4)).toBe(4);
    expect(clampFishCount(1)).toBe(1);
    expect(clampFishCount(200)).toBe(99);
  });
});

describe("sanitizeFishCountDraft", () => {
  it("allows a cleared field while typing", () => {
    expect(sanitizeFishCountDraft("")).toBe("");
    expect(sanitizeFishCountDraft("1")).toBe("1");
    expect(sanitizeFishCountDraft("12")).toBe("12");
    expect(sanitizeFishCountDraft("1a2")).toBe("12");
  });
});

describe("draftFishCountForSpecies", () => {
  it("fills a blank draft on blur/submit, not while typing", () => {
    expect(draftFishCountForSpecies("")).toBe("1");
    expect(draftFishCountForSpecies("8")).toBe("8");
  });
});

describe("fishCountLabel", () => {
  it("pluralizes", () => {
    expect(fishCountLabel(1)).toBe("1 fish");
    expect(fishCountLabel(4)).toBe("4 fish");
  });
});

describe("normalizeSpeciesCounts", () => {
  it("keeps a distinct count per tagged species", () => {
    expect(
      normalizeSpeciesCounts(
        ["Redfish", "Speckled Trout"],
        [
          { species: "Redfish", count: 2 },
          { species: "Speckled Trout", count: 3 },
        ],
      ),
    ).toEqual([
      { species: "Redfish", count: 2 },
      { species: "Speckled Trout", count: 3 },
    ]);
  });

  it("defaults a newly tagged species to 1", () => {
    expect(normalizeSpeciesCounts(["Redfish", "Snook"], [{ species: "Redfish", count: 4 }])).toEqual(
      [
        { species: "Redfish", count: 4 },
        { species: "Snook", count: 1 },
      ],
    );
  });
});

describe("resolveCatchCounts", () => {
  it("prefers per-species counts over a single total", () => {
    const resolved = resolveCatchCounts(
      ["Redfish", "Speckled Trout"],
      [
        { species: "Redfish", count: 2 },
        { species: "Speckled Trout", count: 1 },
      ],
      9,
    );
    expect(resolved.fishCount).toBe(3);
    expect(resolved.speciesCounts).toEqual([
      { species: "Redfish", count: 2 },
      { species: "Speckled Trout", count: 1 },
    ]);
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

  it("uses stored per-species counts on a mixed catch", () => {
    const rows = speciesFishCounts([
      catchOf({
        id: "mix",
        species: "Redfish",
        speciesList: ["Redfish", "Speckled Trout"],
        fishCount: 5,
        speciesCounts: [
          { species: "Redfish", count: 2 },
          { species: "Speckled Trout", count: 3 },
        ],
      }),
    ]);
    expect(rows).toEqual([
      { species: "Speckled Trout", count: 3 },
      { species: "Redfish", count: 2 },
    ]);
    expect(speciesCountLine(rows)).toBe("Speckled Trout 3 · Redfish 2");
  });

  it("splits a legacy mixed photo that only stored a total", () => {
    const rows = countsForCatch({
      species: "Redfish",
      speciesList: ["Redfish", "Speckled Trout"],
      fishCount: 5,
      speciesCounts: [],
    });
    expect(rows).toEqual([
      { species: "Redfish", count: 3 },
      { species: "Speckled Trout", count: 2 },
    ]);
  });
});

describe("catch labels", () => {
  it("shows the breakdown on a multi-species catch", () => {
    const record = catchOf({
      id: "mix",
      species: "Redfish",
      speciesList: ["Redfish", "Speckled Trout"],
      speciesCounts: [
        { species: "Redfish", count: 2 },
        { species: "Speckled Trout", count: 1 },
      ],
      fishCount: 3,
    });
    expect(catchSpeciesTitle(record)).toBe("Redfish 2 · Speckled Trout 1");
    expect(catchFishLabel(record)).toBe("3 fish · Redfish 2 · Speckled Trout 1");
  });
});

describe("alignCountDrafts", () => {
  it("keeps existing drafts and starts new species at 1", () => {
    expect(alignCountDrafts(["Redfish", "Snook"], { Redfish: "4" }, "4")).toEqual({
      Redfish: "4",
      Snook: "1",
    });
  });
});

describe("countsFromDrafts", () => {
  it("uses the single field when only one species is tagged", () => {
    expect(countsFromDrafts(["Redfish"], {}, "7")).toEqual([{ species: "Redfish", count: 7 }]);
  });
});
