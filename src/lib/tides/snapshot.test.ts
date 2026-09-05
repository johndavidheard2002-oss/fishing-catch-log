import { describe, expect, it } from "vitest";
import { getTideSnapshot } from "./index";
import {
  formatTideClock,
  formatTideDetail,
  snapshotFromExtremes,
  timeZoneFromLongitude,
  tidesApplyToHabitat,
  tideWeatherBits,
} from "./snapshot";

describe("tidesApplyToHabitat", () => {
  it("only looks up tides for saltwater", () => {
    expect(tidesApplyToHabitat("freshwater")).toBe(false);
    expect(tidesApplyToHabitat("saltwater-inshore")).toBe(true);
    expect(tidesApplyToHabitat("saltwater-offshore")).toBe(true);
    expect(tidesApplyToHabitat("duck")).toBe(false);
    expect(tidesApplyToHabitat(null)).toBe(false);
  });
});

describe("getTideSnapshot", () => {
  it("does not invent ocean tides for freshwater inland pins", async () => {
    const snap = await getTideSnapshot({
      latitude: 30.388,
      longitude: -97.975,
      at: new Date("2025-07-12T12:00:00.000Z"),
      habitat: "freshwater",
    });
    expect(snap.applies).toBe(false);
    expect(snap.tide).toBeNull();
    expect(snap.heightFt).toBeNull();
    expect(snap.source).toBe("none");
    expect(snap.note).toMatch(/freshwater/i);
  });

  it("asks for a pin instead of inventing a station", async () => {
    const snap = await getTideSnapshot({
      latitude: null,
      longitude: null,
      at: new Date("2025-07-12T12:00:00.000Z"),
      habitat: "saltwater-inshore",
    });
    expect(snap.applies).toBe(true);
    expect(snap.tide).toBeNull();
    expect(snap.note).toMatch(/pin/i);
  });
});

describe("snapshotFromExtremes", () => {
  const extremes = [
    { at: new Date("2025-07-12T10:00:00.000Z"), type: "low" as const, heightFt: 0.4 },
    { at: new Date("2025-07-12T16:00:00.000Z"), type: "high" as const, heightFt: 2.8 },
    { at: new Date("2025-07-12T22:00:00.000Z"), type: "low" as const, heightFt: 0.2 },
  ];

  it("calls incoming on the flood and lists the next high and low", () => {
    const snap = snapshotFromExtremes(extremes, new Date("2025-07-12T13:00:00.000Z"));
    expect(snap?.tide).toBe("incoming");
    expect(snap?.heightFt).toBeCloseTo(1.6, 1);
    expect(snap?.nextHighAt).toBe("2025-07-12T16:00:00.000Z");
    expect(snap?.nextHighFt).toBe(2.8);
    expect(snap?.nextLowAt).toBe("2025-07-12T22:00:00.000Z");
  });

  it("calls high when the clock is on the high", () => {
    const snap = snapshotFromExtremes(extremes, new Date("2025-07-12T16:10:00.000Z"));
    expect(snap?.tide).toBe("high");
  });
});

describe("tideWeatherBits", () => {
  it("omits tides on freshwater", () => {
    expect(
      tideWeatherBits({
        habitat: "freshwater",
        tide: "incoming",
        tideHeightFt: 1.2,
      }),
    ).toEqual([]);
  });

  it("includes stage and next extremes on saltwater", () => {
    const bits = tideWeatherBits({
      habitat: "saltwater-inshore",
      tide: "incoming",
      tideHeightFt: 1.2,
      tideDetail: "High 4:00 PM 2.8 ft · Low 10:00 PM 0.2 ft",
    });
    expect(bits[0]).toMatch(/Incoming 1.2 ft/);
    expect(bits[1]).toContain("High");
  });
});

describe("formatTideDetail", () => {
  it("joins the next high and low", () => {
    const line = formatTideDetail({
      nextHighAt: "2025-07-12T16:00:00.000Z",
      nextHighFt: 2.8,
      nextLowAt: "2025-07-12T22:00:00.000Z",
      nextLowFt: 0.2,
    });
    expect(line).toContain("High");
    expect(line).toContain("Low");
    expect(line).toContain("2.8");
  });

  it("names the NOAA station so the clock can be checked", () => {
    const line = formatTideDetail({
      nextHighAt: "2026-09-06T10:03:00.000Z",
      nextHighFt: 1.526,
      nextLowAt: "2026-09-06T23:01:00.000Z",
      nextLowFt: 0.053,
      stationName: "Port Aransas",
      longitude: -97.0611,
    });
    expect(line).toContain("Port Aransas");
    expect(line).toContain("1.5");
    expect(line).toContain("5:03 AM");
    expect(line).toContain("6:01 PM");
  });

  it("prints Lynchburg NOAA GMT highs in America/Chicago, not UTC", () => {
    const line = formatTideDetail({
      nextHighAt: "2026-09-05T12:35:00.000Z",
      nextHighFt: 1.867,
      nextLowAt: "2026-09-06T03:59:00.000Z",
      nextLowFt: -0.17,
      longitude: -95.078,
    });
    expect(line).toContain("7:35 AM");
    expect(line).toContain("10:59 PM");
    expect(line).not.toContain("12:35 PM");
  });
});

describe("timeZoneFromLongitude", () => {
  it("uses Central time for Texas pins", () => {
    expect(timeZoneFromLongitude(-95.078)).toBe("America/Chicago");
    expect(timeZoneFromLongitude(-97.0611)).toBe("America/Chicago");
  });
});

describe("formatTideClock", () => {
  it("shows the user-reported Hawaii stamp when a Niihau GMT high is printed in Chicago", () => {
    // NOAA 1610367 2026-09-05 11:48 HST high 1.721 ft = 21:48Z
    expect(formatTideClock("2026-09-05T21:48:00.000Z", "America/Chicago")).toBe("4:48 PM");
    expect(formatTideClock("2026-09-05T13:37:00.000Z", "America/Chicago")).toBe("8:37 AM");
  });
});
