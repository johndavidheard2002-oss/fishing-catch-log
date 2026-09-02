import { describe, expect, it } from "vitest";
import { baitSpotsOnMonthDay, baitSpotsWithPins, catchesOnMonthDay, fullDateLabel, groupBaitSpotsByDate, groupBaitSpotsByYear, groupCatchesByDate, groupCatchesByYear, localDateKey, monthDayKey, monthDayLabel, monthGrid, shiftMonth, spotsWithPins, uniqueSpotLabels, yearFromDateKey, yearsOnMonthDay } from "./calendar";
import { baitOf, catchOf } from "./testing";
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

describe("spotsWithPins", () => {
  it("maps every distinct pin on a day and skips trips with no coordinates", () => {
    const dawn = catchOf({
      id: "dawn",
      placeName: "Mosquito Lagoon, FL",
      latitude: 28.738,
      longitude: -80.755,
      caughtAt: new Date(2025, 6, 12, 7, 15).toISOString(),
    });
    const afternoon = catchOf({
      id: "afternoon",
      placeName: "Gulf Stream, FL",
      latitude: 25.76,
      longitude: -80.02,
      caughtAt: new Date(2025, 6, 12, 15, 40).toISOString(),
    });
    const unpinned = catchOf({
      id: "unpinned",
      placeName: "Dock",
      latitude: null,
      longitude: null,
      caughtAt: new Date(2025, 6, 12, 12, 0).toISOString(),
    });
    const pins = spotsWithPins([dawn, afternoon, unpinned]);
    expect(pins).toHaveLength(2);
    expect(pins.map((s) => s.placeName).sort()).toEqual(["Gulf Stream, FL", "Mosquito Lagoon, FL"]);
    expect(spotsWithPins([unpinned])).toEqual([]);
  });
});

describe("catchesOnMonthDay", () => {
  it("combines the same month-day across years and skips neighboring days", () => {
    const y25 = catchOn(new Date(2025, 8, 2, 7, 10), "25");
    const y24 = catchOn(new Date(2024, 8, 2, 18, 40), "24");
    const y23 = catchOn(new Date(2023, 8, 2, 12, 0), "23");
    const next = catchOn(new Date(2025, 8, 3, 7, 10), "next");
    const ids = catchesOnMonthDay([y25, y24, next, y23], "2025-09-02").map((r) => r.id);
    expect(ids.sort()).toEqual(["23", "24", "25"]);
    expect(monthDayKey("2025-09-02")).toBe("09-02");
    expect(monthDayKey(y24.caughtAt)).toBe("09-02");
  });

  it("groups combined days by year, newest first", () => {
    const y25a = catchOn(new Date(2025, 8, 2, 18, 0), "25dusk");
    const y25b = catchOn(new Date(2025, 8, 2, 6, 0), "25dawn");
    const y24 = catchOn(new Date(2024, 8, 2, 12, 0), "24");
    const groups = groupCatchesByYear(catchesOnMonthDay([y25a, y24, y25b], "2026-09-02"));
    expect(groups.map((g) => g.year)).toEqual([2025, 2024]);
    expect(groups[0].catches.map((c) => c.id)).toEqual(["25dawn", "25dusk"]);
    expect(groups[1].catches.map((c) => c.id)).toEqual(["24"]);
    expect(fullDateLabel(groups[1].dateKey)).toBe("Sep 2, 2024");
  });

  it("matches leap day only on Feb 29, not Feb 28", () => {
    const leap = catchOn(new Date(2024, 1, 29, 7, 0), "leap");
    const eve = catchOn(new Date(2024, 1, 28, 7, 0), "eve");
    expect(catchesOnMonthDay([leap, eve], "2024-02-29").map((r) => r.id)).toEqual(["leap"]);
    expect(catchesOnMonthDay([leap, eve], "2023-02-28").map((r) => r.id)).toEqual(["eve"]);
    expect(yearFromDateKey("2024-02-29")).toBe(2024);
    expect(monthDayLabel("2025-09-02")).toBe("Sep 2");
    expect(fullDateLabel("2024-09-02")).toBe("Sep 2, 2024");
    expect(fullDateLabel("2024-02-29")).toBe("Feb 29, 2024");
  });

  it("maps pins from the same month-day in different years", () => {
    const y25 = catchOf({
      id: "25",
      placeName: "Mosquito Lagoon, FL",
      latitude: 28.738,
      longitude: -80.755,
      caughtAt: new Date(2025, 8, 2, 7, 0).toISOString(),
    });
    const y24 = catchOf({
      id: "24",
      placeName: "Chesapeake Bay, MD",
      latitude: 38.99,
      longitude: -76.4,
      caughtAt: new Date(2024, 8, 2, 18, 0).toISOString(),
    });
    const combined = catchesOnMonthDay([y25, y24], "2026-09-02");
    expect(spotsWithPins(combined)).toHaveLength(2);
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

function baitOn(local: Date, id: string) {
  return baitOf({
    id,
    loggedAt: local.toISOString(),
    createdAt: local.toISOString(),
    updatedAt: local.toISOString(),
  });
}

describe("groupBaitSpotsByDate", () => {
  it("groups bait holes on the same local day and orders by time", () => {
    const later = baitOn(new Date(2025, 6, 12, 18, 5), "dusk");
    const earlier = baitOn(new Date(2025, 6, 12, 6, 10), "dawn");
    const next = baitOn(new Date(2025, 6, 13, 6, 10), "next");
    const groups = groupBaitSpotsByDate([later, next, earlier]);
    expect(groups.get("2025-07-12")?.map((r) => r.id)).toEqual(["dawn", "dusk"]);
    expect(groups.get("2025-07-13")?.map((r) => r.id)).toEqual(["next"]);
  });
});

describe("baitSpotsOnMonthDay", () => {
  it("combines the same month-day across years and skips neighboring days", () => {
    const y25 = baitOn(new Date(2025, 8, 2, 7, 10), "25");
    const y24 = baitOn(new Date(2024, 8, 2, 18, 40), "24");
    const next = baitOn(new Date(2025, 8, 3, 7, 10), "next");
    const ids = baitSpotsOnMonthDay([y25, y24, next], "2025-09-02").map((r) => r.id);
    expect(ids.sort()).toEqual(["24", "25"]);
    expect(monthDayKey(y24.loggedAt)).toBe("09-02");
  });

  it("groups combined bait days by year, newest first", () => {
    const y25a = baitOn(new Date(2025, 8, 2, 18, 0), "25dusk");
    const y25b = baitOn(new Date(2025, 8, 2, 6, 0), "25dawn");
    const y24 = baitOn(new Date(2024, 8, 2, 12, 0), "24");
    const groups = groupBaitSpotsByYear(baitSpotsOnMonthDay([y25a, y24, y25b], "2026-09-02"));
    expect(groups.map((g) => g.year)).toEqual([2025, 2024]);
    expect(groups[0].spots.map((s) => s.id)).toEqual(["25dawn", "25dusk"]);
  });

  it("matches leap-day bait only on Feb 29", () => {
    const leap = baitOn(new Date(2024, 1, 29, 7, 0), "leap");
    const eve = baitOn(new Date(2024, 1, 28, 7, 0), "eve");
    expect(baitSpotsOnMonthDay([leap, eve], "2024-02-29").map((r) => r.id)).toEqual(["leap"]);
    expect(baitSpotsOnMonthDay([leap, eve], "2023-02-28").map((r) => r.id)).toEqual(["eve"]);
  });
});

describe("baitSpotsWithPins", () => {
  it("keeps pinned bait holes and skips missing coordinates", () => {
    const pinned = baitOf({ id: "pinned", latitude: 28.735, longitude: -80.754 });
    const unpinned = baitOf({ id: "unpinned", latitude: null, longitude: null });
    expect(baitSpotsWithPins([pinned, unpinned]).map((s) => s.id)).toEqual(["pinned"]);
  });
});

describe("yearsOnMonthDay", () => {
  it("counts years from both catches and bait on the same month-day", () => {
    const catch25 = catchOn(new Date(2025, 8, 2, 7, 0), "c25");
    const bait24 = baitOn(new Date(2024, 8, 2, 12, 0), "b24");
    expect(yearsOnMonthDay([catch25], [bait24], "2026-09-02")).toEqual([2025, 2024]);
  });
});
