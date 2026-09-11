import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { catchOf, baitOf } from "./testing";
import {
  pinForPlannedSpot,
  planDayReferenceAt,
  plannedDayTideDetail,
  plannedSpotClosestTide,
} from "./plan-tides";
import type { TideSnapshot } from "./tides/snapshot";

const snap: TideSnapshot = {
  applies: true,
  tide: "incoming",
  heightFt: 1.2,
  nextHighAt: "2026-10-10T16:00:00.000Z",
  nextHighFt: 2.8,
  nextLowAt: "2026-10-10T22:00:00.000Z",
  nextLowFt: 0.2,
  source: "noaa",
  note: "",
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
  it("prints that day's high/low and the closer event to the catch clock", () => {
    const detail = plannedDayTideDetail(snap, -80.63);
    expect(detail).toContain("High");
    expect(detail).toContain("Low");
    const pin = {
      latitude: 28.41,
      longitude: -80.63,
      habitat: "saltwater-inshore" as const,
      caughtAt: "2026-09-01T15:30:00.000Z",
    };
    expect(plannedSpotClosestTide(snap, "2026-10-10", pin)).toBe("High 12:00 PM");
    expect(
      plannedSpotClosestTide(snap, "2026-10-10", {
        ...pin,
        caughtAt: "2026-09-01T21:30:00.000Z",
      }),
    ).toBe("Low 6:00 PM");
    expect(
      plannedSpotClosestTide({ ...snap, applies: false }, "2026-10-10", pin),
    ).toBe("");
  });
});

describe("Plan Planned panel wires day tides", () => {
  it("shows the planned day's tides and a closest tide on each photo row", () => {
    const plan = readFileSync(resolve(__dirname, "../components/PlanClient.tsx"), "utf8");
    expect(plan).toContain("plannedDayTideDetail");
    expect(plan).toContain("plannedSpotClosestTide");
    expect(plan).toContain("pinForPlannedSpot");
    expect(plan).toContain("/api/assist/weather");
    expect(plan).toContain('data-testid="plan-day-tides"');
    expect(plan).toContain('data-testid="plan-day-spot-tide"');
    expect(plan).toContain("selectPlanDay");
    expect(plan).toContain("data-no-tab-swipe");
    expect(plan).toContain('type="button"');
  });
});
