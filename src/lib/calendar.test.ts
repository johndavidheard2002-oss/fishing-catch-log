import { describe, expect, it } from "vitest";
import { groupCatchesByDate, localDateKey, monthGrid, shiftMonth, uniqueSpotLabels } from "./calendar";
import { catchOf } from "./testing";
import type { CatchRecord } from "./types";

function catchOn(local: Date, id: string): CatchRecord {
  return catchOf({
    id,
    caughtAt: local.toISOString(),
    createdAt: local.toISOString(),
    updatedAt: local.toISOString(),
  });
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

  it("keeps two spots on the same day as separate labels", () => {
    const dawn = catchOf({
      id: "dawn",
      placeName: "Pace Bend, Lake Travis, TX",
      latitude: 30.458,
      longitude: -98.012,
      caughtAt: new Date(2025, 6, 12, 7, 15).toISOString(),
    });
    const afternoon = catchOf({
      id: "afternoon",
      placeName: "Lake Travis, TX",
      latitude: 30.388,
      longitude: -97.975,
      caughtAt: new Date(2025, 6, 12, 15, 40).toISOString(),
    });
    expect(uniqueSpotLabels([dawn, afternoon])).toEqual([
      "Pace Bend, Lake Travis, TX",
      "Lake Travis, TX",
    ]);
  });

  it("counts two same-day pins even when reverse-geocode names match", () => {
    const dawn = catchOf({
      id: "dawn",
      placeName: "Lake Travis, TX",
      latitude: 30.458,
      longitude: -98.012,
      caughtAt: new Date(2025, 6, 12, 7, 15).toISOString(),
    });
    const afternoon = catchOf({
      id: "afternoon",
      placeName: "Lake Travis, TX",
      latitude: 30.388,
      longitude: -97.975,
      caughtAt: new Date(2025, 6, 12, 15, 40).toISOString(),
    });
    const labels = uniqueSpotLabels([dawn, afternoon]);
    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain("30.458");
    expect(labels[1]).toContain("30.388");
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
