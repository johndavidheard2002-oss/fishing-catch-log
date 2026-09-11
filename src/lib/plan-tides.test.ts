import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { catchOf, baitOf } from "./testing";
import {
  applyCatchTideSnapshot,
  pinForPlannedSpot,
  planDayReferenceAt,
  plannedDayTideDetail,
  plannedSpotSameTide,
  sameTideChipsForSpots,
} from "./plan-tides";
import { uniqueNotesByPlace } from "./plan";
import type { TideSnapshot } from "./tides/snapshot";

const extremes = [
  { at: "2026-10-10T05:46:00.000Z", type: "low" as const, heightFt: 0.5 },
  { at: "2026-10-10T12:09:00.000Z", type: "high" as const, heightFt: 4.7 },
  { at: "2026-10-10T18:46:00.000Z", type: "low" as const, heightFt: 0.6 },
];

const snap: TideSnapshot = {
  applies: true,
  tide: "outgoing",
  heightFt: 4.5,
  nextHighAt: "2026-10-10T12:09:00.000Z",
  nextHighFt: 4.7,
  nextLowAt: "2026-10-10T05:46:00.000Z",
  nextLowFt: 0.5,
  source: "noaa",
  note: "",
  extremes,
};

describe("planDayReferenceAt", () => {
  it("copies a catch clock onto the planned day", () => {
    const at = planDayReferenceAt("2026-10-10", "2026-09-01T14:00:00.000Z");
    expect(at?.toISOString()).toBe("2026-10-10T14:00:00.000Z");
    expect(planDayReferenceAt("2026-10-11", null)?.toISOString()).toBe("2026-10-11T16:00:00.000Z");
    expect(planDayReferenceAt("nope")).toBeNull();
  });
});

describe("pinForPlannedSpot", () => {
  it("uses the source catch pin, then a same-place journal catch", () => {
    const redfish = catchOf({
      id: "c-red",
      placeName: "Beach marker 42",
      habitat: "saltwater-inshore",
      latitude: 28.41,
      longitude: -80.63,
      caughtAt: "2026-09-01T14:00:00.000Z",
    });
    expect(pinForPlannedSpot({ sourceCatchId: "c-red" }, { catches: [redfish] })).toEqual({
      latitude: 28.41,
      longitude: -80.63,
      habitat: "saltwater-inshore",
      caughtAt: "2026-09-01T14:00:00.000Z",
      tideHeightFt: null,
      tide: null,
    });
    expect(pinForPlannedSpot({ placeName: "Beach marker 42" }, { catches: [redfish] })?.latitude).toBe(
      28.41,
    );
    expect(
      pinForPlannedSpot(
        { sourceBaitId: "b1" },
        { baitSpots: [baitOf({ id: "b1", loggedAt: "2026-08-02T14:00:00.000Z" })] },
      )?.caughtAt,
    ).toBe("2026-08-02T14:00:00.000Z");
  });
});

describe("planned day and photo tide labels", () => {
  it("prints that day's high/low header", () => {
    const detail = plannedDayTideDetail(snap, -80.63);
    expect(detail).toContain("High");
    expect(detail).toContain("Low");
  });

  it("shows the plan-day clock when height matches a catch just after High, not a distant Low", () => {
    const pin = {
      latitude: 28.41,
      longitude: -80.63,
      habitat: "saltwater-inshore" as const,
      caughtAt: "2026-09-01T12:14:00.000Z",
      tideHeightFt: 4.5,
      tide: "outgoing",
    };
    const label = plannedSpotSameTide(snap, "2026-10-10", pin);
    expect(label).toMatch(/outgoing/i);
    expect(label).not.toMatch(/incoming/i);
    expect(label).not.toMatch(/^Low\b/);
    expect(label).not.toContain("1:46 AM");
    expect(label).not.toContain("2:46 PM");
    // High 8:09 AM EDT (12:09Z) 4.7ft → Low 2:46 PM (18:46Z) 0.6ft at 4.5ft
    expect(label).toBe("8:28 AM outgoing");
    expect(
      plannedSpotSameTide({ ...snap, applies: false }, "2026-10-10", pin),
    ).toBe("");
  });

  it("picks matching incoming/outgoing and never the opposite equal-height time", () => {
    const incoming = plannedSpotSameTide(snap, "2026-10-10", {
      latitude: 28.41,
      longitude: -80.63,
      habitat: "saltwater-inshore",
      caughtAt: "2026-09-01T11:50:00.000Z",
      tideHeightFt: 4.5,
      tide: "incoming",
    });
    const outgoing = plannedSpotSameTide(snap, "2026-10-10", {
      latitude: 28.41,
      longitude: -80.63,
      habitat: "saltwater-inshore",
      caughtAt: "2026-09-01T12:14:00.000Z",
      tideHeightFt: 4.5,
      tide: "outgoing",
    });
    expect(incoming).toBe("7:50 AM incoming");
    expect(outgoing).toBe("8:28 AM outgoing");
    expect(incoming).not.toEqual(outgoing);
    expect(incoming).not.toMatch(/outgoing/i);
    expect(outgoing).not.toMatch(/incoming/i);
    expect(
      plannedSpotSameTide(
        { ...snap, tide: "outgoing", heightFt: 2.7 },
        "2026-10-10",
        {
          latitude: 28.41,
          longitude: -80.63,
          habitat: "saltwater-inshore",
          caughtAt: "2026-09-01T11:50:00.000Z",
          tideHeightFt: 4.5,
          tide: "incoming",
        },
      ),
    ).toBe("7:50 AM incoming");
  });

  it("chips every planned Redfish row at the same hole, including stored heights off that day's range", () => {
    const aransas: TideSnapshot = {
      applies: true,
      tide: "incoming",
      heightFt: 1.4,
      nextHighAt: "2026-10-09T20:35:00.000Z",
      nextHighFt: 2.2,
      nextLowAt: "2026-10-09T13:32:00.000Z",
      nextLowFt: 1.0,
      source: "noaa",
      note: "",
      extremes: [
        { at: "2026-10-09T13:32:00.000Z", type: "low", heightFt: 1.0 },
        { at: "2026-10-09T20:35:00.000Z", type: "high", heightFt: 2.2 },
        { at: "2026-10-10T02:10:00.000Z", type: "low", heightFt: 0.9 },
      ],
    };
    const catches = [1, 2, 3, 4, 5].map((n) =>
      catchOf({
        id: `c-red-${n}`,
        placeName: "Beach marker 42",
        habitat: "saltwater-inshore",
        latitude: 27.84,
        longitude: -97.05,
        caughtAt: `2026-09-0${n}T14:00:00.000Z`,
        tide: n === 5 ? "outgoing" : "incoming",
        tideHeightFt: n === 1 ? 1.5 : n === 5 ? 1.8 : 4.5,
      }),
    );
    const spots = uniqueNotesByPlace(
      catches.map((row) => ({
        id: `note-${row.id}`,
        placeName: row.placeName,
        sourceCatchId: row.id,
        kind: "plan-spot" as const,
      })),
    );
    expect(spots).toHaveLength(5);
    const chips = sameTideChipsForSpots(spots, aransas, "2026-10-09", { catches });
    expect(Object.keys(chips)).toHaveLength(5);
    for (const spot of spots) {
      expect(chips[spot.id]).toBeTruthy();
      expect(chips[spot.id]).not.toMatch(/^Low\b/);
    }
    expect(chips["note-c-red-5"]).toMatch(/outgoing/i);
    expect(chips["note-c-red-1"]).toMatch(/incoming/i);

    const liveLike = uniqueNotesByPlace(
      [1, 2, 3, 4, 5].map((n) => ({
        id: `live-${n}`,
        placeName: "Beach marker 42",
        sourceCatchId: `live-c-${n}`,
        kind: "plan-spot" as const,
      })),
    );
    const liveCatches = [1, 2, 3, 4, 5].map((n) =>
      catchOf({
        id: `live-c-${n}`,
        placeName: "Beach marker 42",
        habitat: "saltwater-inshore",
        latitude: 27.84,
        longitude: -97.05,
        caughtAt: `2026-08-0${n}T15:00:00.000Z`,
        tide: n === 2 ? "incoming" : null,
        tideHeightFt: n === 2 ? 1.45 : n % 2 === 0 ? 4.5 : null,
      }),
    );
    const liveChips = sameTideChipsForSpots(liveLike, aransas, "2026-10-09", { catches: liveCatches });
    expect(liveLike).toHaveLength(5);
    expect(Object.keys(liveChips)).toHaveLength(5);
    expect(liveChips["live-2"]).toMatch(/incoming/i);
  });

  it("uses a catch-time station snapshot so a stored 4.5 ft height still chips on a 2.2 ft day", () => {
    const pin = {
      latitude: 27.84,
      longitude: -97.05,
      habitat: "saltwater-inshore" as const,
      caughtAt: "2026-09-03T14:30:00.000Z",
      tideHeightFt: 4.5,
      tide: null,
    };
    const daySnap: TideSnapshot = {
      ...snap,
      nextHighAt: "2026-10-09T20:35:00.000Z",
      nextHighFt: 2.2,
      nextLowAt: "2026-10-09T13:32:00.000Z",
      nextLowFt: 1.0,
      extremes: [
        { at: "2026-10-09T13:32:00.000Z", type: "low", heightFt: 1.0 },
        { at: "2026-10-09T20:35:00.000Z", type: "high", heightFt: 2.2 },
      ],
    };
    expect(plannedSpotSameTide(daySnap, "2026-10-09", pin)).toMatch(/incoming|High/);
    const resolved = applyCatchTideSnapshot(pin, {
      applies: true,
      tide: "incoming",
      heightFt: 1.4,
      nextHighAt: null,
      nextHighFt: null,
      nextLowAt: null,
      nextLowFt: null,
      source: "noaa",
      note: "",
    });
    expect(resolved.tideHeightFt).toBe(1.4);
    expect(resolved.tide).toBe("incoming");
    expect(plannedSpotSameTide(daySnap, "2026-10-09", resolved)).toMatch(/incoming/i);
  });
});

describe("Plan Planned panel wires day tides", () => {
  it("shows the planned day's tides and a closest tide on each photo row", () => {
    const plan = readFileSync(resolve(__dirname, "../components/PlanClient.tsx"), "utf8");
    expect(plan).toContain("plannedDayTideDetail");
    expect(plan).toContain("sameTideChipsForSpots");
    expect(plan).toContain("sameTideById");
    expect(plan).toContain("sameTideChipsForSpots");
    expect(plan).toContain("catchTideLookupKey");
    expect(plan).not.toContain("tideHeightFt == null &&");
    expect(plan).not.toContain("plannedSpotClosestTide");
    expect(plan).not.toContain("closestCivilDayTide");
    expect(plan).toContain("pinForPlannedSpot");
    expect(plan).toContain("/api/assist/weather");
    expect(plan).toContain('data-testid="plan-day-tides"');
    expect(plan).toContain('data-testid="plan-day-spot-tide"');
    expect(plan).toContain("selectPlanDay");
    expect(plan).toContain("data-no-tab-swipe");
    expect(plan).toContain('type="button"');
  });
});
