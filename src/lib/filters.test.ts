import { describe, expect, it } from "vitest";
import { groupSpots, matchesFilters } from "./filters";
import type { CatchRecord } from "./types";

function catchOf(partial: Partial<CatchRecord> & { id: string; species: string }): CatchRecord {
  return {
    photoPath: null,
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
    caughtAt: "2025-07-12T20:00:00.000Z",
    timeOfDay: "afternoon",
    season: "summer",
    notes: null,
    bait: null,
    tide: null,
    waterClarity: null,
    createdAt: "2025-07-12T20:00:00.000Z",
    updatedAt: "2025-07-12T20:00:00.000Z",
    ...partial,
  };
}

describe("matchesFilters", () => {
  const bass = catchOf({ id: "1", species: "Largemouth Bass", temperatureF: 88 });

  it("filters cloudy + 70–80°F weather windows", () => {
    const cloudy = catchOf({
      id: "2",
      species: "Walleye",
      weatherCondition: "cloudy",
      temperatureF: 74,
      placeName: "Lake Erie, OH",
    });
    const filters = { conditions: ["cloudy" as const], tempMin: 70, tempMax: 80 };
    expect(matchesFilters(cloudy, filters)).toBe(true);
    expect(matchesFilters(bass, filters)).toBe(false);
  });

  it("filters by species substring and season", () => {
    expect(matchesFilters(bass, { species: "bass", seasons: ["summer"] })).toBe(true);
    expect(matchesFilters(bass, { species: "trout" })).toBe(false);
    expect(matchesFilters(bass, { seasons: ["spring"] })).toBe(false);
  });
});

describe("groupSpots", () => {
  it("groups catches that share a place name", () => {
    const a = catchOf({ id: "a", species: "Largemouth Bass" });
    const b = catchOf({ id: "b", species: "Largemouth Bass", caughtAt: "2025-07-13T11:00:00.000Z" });
    const c = catchOf({
      id: "c",
      species: "Redfish",
      placeName: "Mosquito Lagoon, FL",
      latitude: 28.738,
      longitude: -80.755,
    });
    const spots = groupSpots([a, b, c]);
    expect(spots).toHaveLength(2);
    const travis = spots.find((s) => s.placeName === "Lake Travis, TX");
    expect(travis?.catchCount).toBe(2);
  });
});
