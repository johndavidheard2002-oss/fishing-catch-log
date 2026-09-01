import { describe, expect, it } from "vitest";
import { groupSpots } from "./filters";
import {
  isPositiveCatch,
  planHeadline,
  scoreWindowAgainstCatch,
  suggestionStrength,
  suggestFromWindows,
} from "./plan";
import type { CatchRecord, ForecastWindow } from "./types";

function catchOf(partial: Partial<CatchRecord> & { id: string }): CatchRecord {
  return {
    photoPath: null,
    species: "Largemouth Bass",
    speciesSuggested: null,
    speciesConfidence: null,
    speciesSource: "manual",
    latitude: 40.212,
    longitude: -82.891,
    placeName: "Farm Pond, OH",
    temperatureF: 76,
    weatherCondition: "cloudy",
    windSpeedMph: 5,
    precipitationIn: 0,
    humidity: 61,
    caughtAt: "2025-06-22T19:05:00.000Z",
    timeOfDay: "afternoon",
    season: "summer",
    notes: null,
    bait: "Senko",
    tide: null,
    waterClarity: "clear",
    createdAt: "2025-06-22T19:05:00.000Z",
    updatedAt: "2025-06-22T19:05:00.000Z",
    ...partial,
  };
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
    precipitationIn: 0,
    humidity: 60,
    tide: null,
    tideHeightFt: null,
    weatherSource: "demo",
    tideSource: "none",
    ...partial,
  };
}

describe("isPositiveCatch", () => {
  it("keeps logged fish and drops empty labels", () => {
    expect(isPositiveCatch(catchOf({ id: "1" }))).toBe(true);
    expect(isPositiveCatch(catchOf({ id: "2", species: "Unknown" }))).toBe(false);
    expect(isPositiveCatch(catchOf({ id: "3", species: "skunk" }))).toBe(false);
  });
});

describe("scoreWindowAgainstCatch", () => {
  it("scores cloudy + ~72°F + afternoon like the Farm Pond bass", () => {
    const match = scoreWindowAgainstCatch(
      windowOf({ temperatureF: 72, weatherCondition: "cloudy", timeOfDay: "afternoon" }),
      catchOf({ id: "bass" }),
    );
    expect(match.score).toBeGreaterThanOrEqual(30);
    expect(match.reasons).toEqual(
      expect.arrayContaining(["Afternoon", "Cloudy"]),
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
    const bass = catchOf({ id: "bass" });
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
      catchOf({ id: "x" }),
    );
    expect(text).toContain("Farm Pond, OH");
    expect(text).toContain("Largemouth Bass");
  });
});
