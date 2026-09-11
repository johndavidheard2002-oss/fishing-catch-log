import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { catchOf, baitOf } from "./testing";
import {
  pinForPlannedSpot,
  planDayReferenceAt,
  plannedDayTideDetail,
  plannedSpotSameTide,
} from "./plan-tides";
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
    expect(label).toMatch(/falling/i);
    expect(label).not.toMatch(/^Low\b/);
    expect(label).not.toContain("1:46 AM");
    expect(label).not.toContain("2:46 PM");
    // High 8:09 AM EDT (12:09Z) 4.7ft → Low 2:46 PM (18:46Z) 0.6ft at 4.5ft
    expect(label).toBe("8:28 AM falling");
    expect(
      plannedSpotSameTide({ ...snap, applies: false }, "2026-10-10", pin),
    ).toBe("");
  });

  it("prefers the falling equal-height time when flood and ebb both match", () => {
    const risingOnly = plannedSpotSameTide(snap, "2026-10-10", {
      latitude: 28.41,
      longitude: -80.63,
      habitat: "saltwater-inshore",
      caughtAt: "2026-09-01T11:50:00.000Z",
      tideHeightFt: 4.5,
      tide: "incoming",
    });
    expect(risingOnly).toMatch(/rising/i);
    expect(risingOnly).not.toEqual(plannedSpotSameTide(snap, "2026-10-10", {
      latitude: 28.41,
      longitude: -80.63,
      habitat: "saltwater-inshore",
      caughtAt: "2026-09-01T12:14:00.000Z",
      tideHeightFt: 4.5,
      tide: "outgoing",
    }));
  });
});

describe("Plan Planned panel wires day tides", () => {
  it("shows the planned day's tides and a closest tide on each photo row", () => {
    const plan = readFileSync(resolve(__dirname, "../components/PlanClient.tsx"), "utf8");
    expect(plan).toContain("plannedDayTideDetail");
    expect(plan).toContain("plannedSpotSameTide");
    expect(plan).toContain("sameTideById");
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
