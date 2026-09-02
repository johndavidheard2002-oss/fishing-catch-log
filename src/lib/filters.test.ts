import { describe, expect, it } from "vitest";
import { groupSpots, matchesFilters } from "./filters";
import { catchOf } from "./testing";

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

  it("filters freshwater vs inshore vs offshore", () => {
    const redfish = catchOf({ id: "r", species: "Redfish", habitat: "saltwater-inshore" });
    const mahi = catchOf({ id: "m", species: "Mahi-mahi", habitat: "saltwater-offshore" });
    expect(matchesFilters(bass, { habitats: ["freshwater"] })).toBe(true);
    expect(matchesFilters(redfish, { habitats: ["freshwater"] })).toBe(false);
    expect(matchesFilters(redfish, { habitats: ["saltwater-inshore"] })).toBe(true);
    expect(matchesFilters(mahi, { habitats: ["saltwater-inshore"] })).toBe(false);
    expect(matchesFilters(mahi, { habitats: ["saltwater-offshore"] })).toBe(true);
    expect(
      matchesFilters(redfish, { habitats: ["saltwater-inshore", "saltwater-offshore"] }),
    ).toBe(true);
  });

  it("filters by moon phase and pressure trend", () => {
    const full = catchOf({ id: "f", moonPhase: "Full", pressureTrend: "falling" });
    expect(matchesFilters(full, { moonPhases: ["Full"] })).toBe(true);
    expect(matchesFilters(full, { moonPhases: ["New"] })).toBe(false);
    expect(matchesFilters(full, { pressureTrends: ["falling"] })).toBe(true);
    expect(matchesFilters(bass, { moonPhases: ["Full"] })).toBe(false);
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
