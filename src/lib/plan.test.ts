import { describe, expect, it } from "vitest";
import { groupSpots } from "./filters";
import {
  baitPlanHeadline,
  isPositiveCatch,
  planHeadline,
  scoreWindowAgainstBait,
  scoreWindowAgainstCatch,
  suggestionStrength,
  suggestBaitFromWindows,
  suggestFromWindows,
} from "./plan";
import { catchOf } from "./testing";
import type { BaitSpot, CatchRecord, ForecastWindow } from "./types";

function pondCatch(partial: Partial<CatchRecord> & { id: string }): CatchRecord {
  return catchOf({
    latitude: 40.212,
    longitude: -82.891,
    placeName: "Farm Pond, OH",
    temperatureF: 76,
    weatherCondition: "cloudy",
    windSpeedMph: 5,
    humidity: 61,
    bait: "Senko",
    waterClarity: "clear",
    caughtAt: "2025-06-22T19:05:00.000Z",
    createdAt: "2025-06-22T19:05:00.000Z",
    updatedAt: "2025-06-22T19:05:00.000Z",
    ...partial,
  });
}

function windowOf(partial: Partial<ForecastWindow>): ForecastWindow {
  return {
    at: "2026-09-03T19:00:00.000Z",
    date: "2026-09-03",
    timeOfDay: "afternoon",
    season: "fall",
    latitude: 40.212,
    longitude: -82.891,
    temperatureF: 74,
    weatherCondition: "cloudy",
    windSpeedMph: 6,
    windDirection: "SW",
    precipitationIn: 0,
    humidity: 60,
    moonPhase: "Waxing gibbous",
    moonIllumination: 70,
    pressureInHg: 29.96,
    pressureMb: 1014.5,
    pressureTrend: "steady",
    tide: null,
    tideHeightFt: null,
    weatherSource: "demo",
    tideSource: "none",
    ...partial,
  };
}

describe("isPositiveCatch", () => {
  it("keeps logged fish and drops empty labels", () => {
    expect(isPositiveCatch(pondCatch({ id: "1" }))).toBe(true);
    expect(isPositiveCatch(pondCatch({ id: "2", species: "Unknown" }))).toBe(false);
    expect(isPositiveCatch(pondCatch({ id: "3", species: "skunk" }))).toBe(false);
  });
});

describe("scoreWindowAgainstCatch", () => {
  it("scores cloudy + ~72°F + afternoon like the Farm Pond bass", () => {
    const match = scoreWindowAgainstCatch(
      windowOf({ temperatureF: 72, weatherCondition: "cloudy", timeOfDay: "afternoon" }),
      pondCatch({ id: "bass" }),
    );
    expect(match.score).toBeGreaterThanOrEqual(30);
    expect(match.reasons).toEqual(
      expect.arrayContaining(["Same time of day", "Cloudy"]),
    );
  });

  it("adds tide agreement for coastal history", () => {
    const redfish = catchOf({
      id: "red",
      species: "Redfish",
      placeName: "Mosquito Lagoon, FL",
      tide: "incoming",
      timeOfDay: "dusk",
      weatherCondition: "partly-cloudy",
      temperatureF: 82,
    });
    const withTide = scoreWindowAgainstCatch(
      windowOf({
        timeOfDay: "dusk",
        weatherCondition: "partly-cloudy",
        temperatureF: 80,
        tide: "incoming",
      }),
      redfish,
    );
    const without = scoreWindowAgainstCatch(
      windowOf({
        timeOfDay: "dusk",
        weatherCondition: "partly-cloudy",
        temperatureF: 80,
        tide: "low",
      }),
      redfish,
    );
    expect(withTide.score).toBeGreaterThan(without.score);
    expect(withTide.reasons).toContain("Incoming tide");
  });
});

describe("suggestFromWindows", () => {
  it("ranks the matching spot and points at the past catch", () => {
    const bass = pondCatch({ id: "bass" });
    const trout = catchOf({
      id: "trout",
      species: "Rainbow Trout",
      placeName: "Frying Pan River, CO",
      latitude: 39.368,
      longitude: -106.818,
      temperatureF: 48,
      weatherCondition: "cloudy",
      timeOfDay: "morning",
      season: "spring",
    });
    const spots = groupSpots([bass, trout]);
    const suggestions = suggestFromWindows({
      spots,
      windowsBySpotKey: {
        [spots.find((s) => s.placeName === "Farm Pond, OH")!.key]: [
          windowOf({ temperatureF: 72, weatherCondition: "cloudy" }),
        ],
        [spots.find((s) => s.placeName === "Frying Pan River, CO")!.key]: [
          windowOf({
            timeOfDay: "morning",
            temperatureF: 88,
            weatherCondition: "clear",
            latitude: 39.368,
            longitude: -106.818,
          }),
        ],
      },
    });
    expect(suggestions[0].placeName).toBe("Farm Pond, OH");
    expect(suggestions[0].matches[0].catch.id).toBe("bass");
    expect(suggestions[0].headline).toMatch(/cloudy \+ 72°F \+ afternoon like your Largemouth Bass/i);
    expect(suggestionStrength(suggestions[0].score)).not.toBeUndefined();
  });
});

describe("planHeadline", () => {
  it("names the past trip that drove the match", () => {
    const text = planHeadline(
      windowOf({ temperatureF: 72, weatherCondition: "cloudy", timeOfDay: "morning" }),
      pondCatch({ id: "x" }),
    );
    expect(text).toContain("Farm Pond, OH");
    expect(text).toContain("Largemouth Bass");
  });
});

describe("bait plan matches", () => {
  it("scores a similar tide and sky against a logged shrimp hole", () => {
    const shrimp: BaitSpot = {
      id: "shrimp-1",
      photoPath: null,
      placeName: "Haulover Canal",
      baitTypes: ["Shrimp"],
      latitude: 28.735,
      longitude: -80.754,
      temperatureF: 82,
      weatherCondition: "clear",
      windSpeedMph: 8,
      windDirection: "E",
      precipitationIn: 0,
      humidity: 70,
      moonPhase: null,
      moonIllumination: null,
      pressureInHg: 30.05,
      pressureMb: 1018,
      pressureTrend: "steady",
      loggedAt: "2026-08-02T14:00:00.000Z",
      timeOfDay: "afternoon",
      season: "summer",
      notes: null,
      tide: "incoming",
      tideHeightFt: 1.2,
      tideDetail: null,
      habitat: "saltwater-inshore",
      anglerId: "you",
      sharedWithLinked: false,
      ownerName: "You",
      createdAt: "2026-08-02T14:00:00.000Z",
      updatedAt: "2026-08-02T14:00:00.000Z",
    };
    const match = scoreWindowAgainstBait(
      windowOf({
        latitude: 28.735,
        longitude: -80.754,
        temperatureF: 81,
        weatherCondition: "clear",
        timeOfDay: "afternoon",
        tide: "incoming",
      }),
      shrimp,
    );
    expect(match.score).toBeGreaterThanOrEqual(30);
    expect(baitPlanHeadline(windowOf({ weatherCondition: "clear", timeOfDay: "afternoon" }), shrimp)).toMatch(
      /shrimp at Haulover Canal/i,
    );
    const suggestions = suggestBaitFromWindows({
      groups: [
        {
          key: "bait:28.735,-80.754",
          placeName: "Haulover Canal",
          latitude: 28.735,
          longitude: -80.754,
          visitCount: 1,
          baitTypes: ["Shrimp"],
          lastLoggedAt: shrimp.loggedAt,
          typicalCondition: "clear",
          typicalTime: "afternoon",
          avgTempF: 82,
          spots: [shrimp],
        },
      ],
      windowsBySpotKey: {
        "bait:28.735,-80.754": [
          windowOf({
            latitude: 28.735,
            longitude: -80.754,
            temperatureF: 81,
            weatherCondition: "clear",
            timeOfDay: "afternoon",
            tide: "incoming",
          }),
        ],
      },
    });
    expect(suggestions[0]?.placeName).toBe("Haulover Canal");
    expect(suggestions[0]?.baitTypes).toEqual(["Shrimp"]);
  });
});
