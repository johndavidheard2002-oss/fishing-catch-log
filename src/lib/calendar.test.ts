import { describe, expect, it } from "vitest";
import { groupCatchesByDate, localDateKey, monthGrid, shiftMonth } from "./calendar";
import type { CatchRecord } from "./types";

function catchOn(local: Date, id: string): CatchRecord {
  return {
    id,
    photoPath: null,
    species: "Largemouth Bass",
    speciesSuggested: null,
    speciesConfidence: null,
    speciesSource: "manual",
    latitude: 30.388,
    longitude: -97.975,
    placeName: "Lake Travis, TX",
    temperatureF: 80,
    weatherCondition: "clear",
    windSpeedMph: 6,
    precipitationIn: 0,
    humidity: 50,
    caughtAt: local.toISOString(),
    timeOfDay: "afternoon",
    season: "summer",
    notes: null,
    bait: null,
    tide: null,
    waterClarity: null,
    habitat: "freshwater",
    anglerId: "you",
    sharedWithLinked: false,
    ownerName: "You",
    createdAt: local.toISOString(),
    updatedAt: local.toISOString(),
  };
}

describe("localDateKey", () => {
  it("uses the local calendar day", () => {
    const local = new Date(2025, 6, 12, 8, 30, 0);
    expect(localDateKey(local.toISOString())).toBe("2025-07-12");
  });
});

describe("groupCatchesByDate", () => {
  it("groups two catches on the same local day", () => {
    const a = catchOn(new Date(2025, 6, 12, 6, 10), "dawn");
    const b = catchOn(new Date(2025, 6, 12, 15, 40), "afternoon");
    const c = catchOn(new Date(2025, 6, 13, 6, 10), "next");
    const groups = groupCatchesByDate([a, b, c]);
    expect(groups.get("2025-07-12")?.map((r) => r.id)).toEqual(["dawn", "afternoon"]);
    expect(groups.get("2025-07-13")?.map((r) => r.id)).toEqual(["next"]);
  });

  it("orders a day's catches by time", () => {
    const later = catchOn(new Date(2025, 6, 12, 18, 5), "dusk");
    const earlier = catchOn(new Date(2025, 6, 12, 6, 10), "dawn");
    const groups = groupCatchesByDate([later, earlier]);
    expect(groups.get("2025-07-12")?.map((r) => r.id)).toEqual(["dawn", "dusk"]);
  });
});

describe("monthGrid", () => {
  it("fills complete weeks for July 2025", () => {
    const cells = monthGrid(2025, 6);
    expect(cells.length % 7).toBe(0);
    expect(cells.length).toBeGreaterThanOrEqual(35);
    const inMonth = cells.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0].date).toBe("2025-07-01");
    expect(inMonth[30].date).toBe("2025-07-31");
  });
});

describe("shiftMonth", () => {
  it("wraps December to January", () => {
    expect(shiftMonth(2025, 11, 1)).toEqual({ year: 2026, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});
