import { describe, expect, it } from "vitest";
import { findSimilar, scoreSimilarity } from "./similar";
import type { CatchRecord } from "./types";

function catchOf(partial: Partial<CatchRecord> & { id: string }): CatchRecord {
  return {
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
    caughtAt: "2025-07-12T20:00:00.000Z",
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
    createdAt: "2025-07-12T20:00:00.000Z",
    updatedAt: "2025-07-12T20:00:00.000Z",
    ...partial,
  };
}

describe("scoreSimilarity", () => {
  it("scores same species, spot, season, and weather highly", () => {
    const a = catchOf({ id: "a" });
    const b = catchOf({
      id: "b",
      temperatureF: 82,
      timeOfDay: "afternoon",
      weatherCondition: "clear",
    });
    const match = scoreSimilarity(a, b);
    expect(match.score).toBeGreaterThan(70);
    expect(match.reasons).toContain("Same species");
    expect(match.reasons).toContain("Same spot");
    expect(match.reasons).toContain("Summer");
  });

  it("does not treat a distant winter trout as similar to a summer bass", () => {
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
    const match = scoreSimilarity(bass, trout);
    expect(match.score).toBeLessThan(20);
  });
});

describe("findSimilar", () => {
  it("returns nearby same-species catches and excludes the target", () => {
    const target = catchOf({ id: "target", temperatureF: 88, weatherCondition: "clear" });
    const similar = catchOf({
      id: "similar",
      temperatureF: 74,
      weatherCondition: "fog",
      timeOfDay: "dawn",
    });
    const far = catchOf({
      id: "far",
      species: "Walleye",
      placeName: "Lake Erie, OH",
      latitude: 41.541,
      longitude: -81.635,
      temperatureF: 55,
      weatherCondition: "cloudy",
      season: "spring",
      timeOfDay: "dusk",
    });
    const results = findSimilar(target, [target, similar, far], { minScore: 18 });
    expect(results.map((r) => r.catch.id)).toEqual(["similar"]);
  });
});
