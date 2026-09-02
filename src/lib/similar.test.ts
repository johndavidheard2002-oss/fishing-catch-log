import { describe, expect, it } from "vitest";
import { findSimilar, scoreSimilarity } from "./similar";
import { catchOf } from "./testing";

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

  it("boosts overlapping moon, wind direction, and pressure", () => {
    const a = catchOf({
      id: "a",
      moonPhase: "Full",
      windDirection: "SE",
      pressureTrend: "falling",
      pressureInHg: 29.84,
    });
    const b = catchOf({
      id: "b",
      moonPhase: "Full",
      windDirection: "ESE",
      pressureTrend: "falling",
      pressureInHg: 29.88,
    });
    const match = scoreSimilarity(a, b);
    expect(match.reasons).toEqual(
      expect.arrayContaining(["Full moon", "Nearby wind direction", "Falling pressure"]),
    );
    const unmatched = scoreSimilarity(
      a,
      catchOf({
        id: "c",
        moonPhase: "New",
        windDirection: "N",
        pressureTrend: "rising",
        pressureInHg: 30.2,
      }),
    );
    expect(match.score).toBeGreaterThan(unmatched.score);
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
