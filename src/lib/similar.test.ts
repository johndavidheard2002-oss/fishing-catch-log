import { describe, expect, it } from "vitest";
import {
  findSimilar,
  scoreConditionOverlap,
  scoreSimilarity,
  suggestionStrength,
  veryStrongMatchChip,
  veryStrongMatchLabel,
  VERY_STRONG_MATCH_CHIP,
  VERY_STRONG_MATCH_LABEL,
} from "./similar";
import { catchOf } from "./testing";
import { formatTimeOnly } from "./time";

describe("scoreSimilarity", () => {
  it("scores same species, spot, time of day, and weather highly", () => {
    const a = catchOf({ id: "a" });
    const b = catchOf({
      id: "b",
      temperatureF: 82,
      timeOfDay: "afternoon",
      weatherCondition: "clear",
    });
    const match = scoreSimilarity(a, b);
    expect(match.score).toBeGreaterThan(55);
    expect(match.reasons).toContain("Same species");
    expect(match.reasons).toContain("Same spot");
    expect(match.reasons).toContain("Same time of day");
    expect(match.reasons).not.toContain("Summer");
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

  it("matches if any tagged species overlaps", () => {
    const mixed = catchOf({
      id: "mix",
      species: "Redfish",
      speciesList: ["Redfish", "Speckled Trout"],
      placeName: "Mosquito Lagoon, FL",
      latitude: 28.738,
      longitude: -80.755,
    });
    const trout = catchOf({
      id: "trout-only",
      species: "Speckled Trout",
      speciesList: ["Speckled Trout"],
      placeName: "Mosquito Lagoon, FL",
      latitude: 28.741,
      longitude: -80.752,
    });
    const match = scoreSimilarity(mixed, trout);
    expect(match.reasons).toContain("Shared species");
    expect(match.score).toBeGreaterThan(20);
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

describe("tide and time ranking", () => {
  it("locks the very-strong copy", () => {
    expect(VERY_STRONG_MATCH_LABEL).toBe("Very strong matches with matching tides");
    expect(VERY_STRONG_MATCH_CHIP).toBe("Very strong · matching tides");
    const at = "2026-08-02T11:42:00.000Z";
    const clock = formatTimeOnly(at);
    expect(veryStrongMatchLabel(at)).toBe(`Very strong · conditions match around ${clock}`);
    expect(veryStrongMatchChip(at)).toBe(`Very strong · ${clock}`);
    expect(veryStrongMatchLabel()).toBe(VERY_STRONG_MATCH_LABEL);
  });

  it("weights exact tide stage, height, and clock above weather-only overlap", () => {
    const logged = "2026-07-01T10:42:00.000Z";
    const tideMatch = scoreConditionOverlap(
      {
        timeOfDay: "morning",
        clockAt: "2026-08-02T10:40:00.000Z",
        tide: "incoming",
        tideHeightFt: 2.1,
        weatherCondition: "rain",
        temperatureF: 68,
      },
      {
        timeOfDay: "morning",
        clockAt: logged,
        tide: "rising",
        tideHeightFt: 2.0,
        weatherCondition: "clear",
        temperatureF: 88,
      },
    );
    const weatherOnly = scoreConditionOverlap(
      {
        timeOfDay: "afternoon",
        clockAt: "2026-08-02T19:00:00.000Z",
        tide: "outgoing",
        tideHeightFt: 0.4,
        weatherCondition: "clear",
        temperatureF: 82,
      },
      {
        timeOfDay: "night",
        clockAt: "2026-07-01T02:00:00.000Z",
        tide: "incoming",
        tideHeightFt: 2.2,
        weatherCondition: "clear",
        temperatureF: 80,
      },
    );
    expect(tideMatch.score).toBeGreaterThan(weatherOnly.score);
    expect(suggestionStrength(tideMatch.score, tideMatch)).toBe("very-strong");
    expect(suggestionStrength(weatherOnly.score, weatherOnly)).not.toBe("very-strong");
    expect(tideMatch.reasons[0]).toMatch(/same rising tide ~2\.0 ft/i);
    expect(tideMatch.reasons[0]).toContain(`~${formatTimeOnly(logged)}`);
  });

  it("does not call weather-only overlap very-strong", () => {
    const overlap = scoreConditionOverlap(
      {
        timeOfDay: "afternoon",
        weatherCondition: "clear",
        temperatureF: 80,
        windSpeedMph: 6,
      },
      {
        timeOfDay: "afternoon",
        weatherCondition: "clear",
        temperatureF: 80,
        windSpeedMph: 6,
      },
    );
    expect(overlap.tideStage).toBe("unknown");
    expect(suggestionStrength(overlap.score, overlap)).not.toBe("very-strong");
  });

  it("does not call a match very-strong when tide heights disagree", () => {
    const clock = "2026-08-02T10:40:00.000Z";
    const overlap = scoreConditionOverlap(
      { timeOfDay: "morning", clockAt: clock, tide: "incoming", tideHeightFt: 2.1 },
      { timeOfDay: "morning", clockAt: clock, tide: "incoming", tideHeightFt: 3.6 },
    );
    expect(overlap.tideStage).toBe("exact");
    expect(overlap.tideHeight).toBe("none");
    expect(suggestionStrength(overlap.score, overlap)).not.toBe("very-strong");
  });

  it("labels similar catches very-strong when tide and time agree", () => {
    const a = catchOf({
      id: "a",
      tide: "incoming",
      tideHeightFt: 2.1,
      timeOfDay: "dawn",
      caughtAt: "2025-07-12T10:40:00.000Z",
    });
    const b = catchOf({
      id: "b",
      tide: "incoming",
      tideHeightFt: 2.2,
      timeOfDay: "dawn",
      caughtAt: "2025-08-02T10:38:00.000Z",
    });
    const match = scoreSimilarity(a, b);
    expect(match.strength).toBe("very-strong");
    expect(match.reasons.some((r) => /same rising tide ~2\.2 ft/i.test(r))).toBe(true);
  });
});
