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

  it("filters by species substring and derived time of day", () => {
    expect(matchesFilters(bass, { species: "bass", timesOfDay: ["afternoon"] })).toBe(true);
    expect(matchesFilters(bass, { species: "trout" })).toBe(false);
    expect(matchesFilters(bass, { timesOfDay: ["dawn"] })).toBe(false);
  });

  it("matches any tagged species on a multi-fish catch", () => {
    const mixed = catchOf({
      id: "mix",
      species: "Redfish",
      speciesList: ["Redfish", "Speckled Trout"],
      habitat: "saltwater-inshore",
    });
    expect(matchesFilters(mixed, { species: "trout" })).toBe(true);
    expect(matchesFilters(mixed, { species: "redfish" })).toBe(true);
    expect(matchesFilters(mixed, { species: "snook" })).toBe(false);
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
    expect(travis?.fishCount).toBe(2);
  });

  it("keeps distinct pins even when two same-day catches share a place name", () => {
    const dawn = catchOf({
      id: "dawn",
      placeName: "Lake Travis, TX",
      latitude: 30.458,
      longitude: -98.012,
      caughtAt: "2025-07-12T12:15:00.000Z",
    });
    const afternoon = catchOf({
      id: "afternoon",
      placeName: "Lake Travis, TX",
      latitude: 30.388,
      longitude: -97.975,
      caughtAt: "2025-07-12T20:40:00.000Z",
    });
    const spots = groupSpots([dawn, afternoon]);
    expect(spots).toHaveLength(2);
    expect(spots.map((s) => s.catchCount)).toEqual([1, 1]);
  });

  it("still groups nearby GPS jitter at the same hole", () => {
    const a = catchOf({
      id: "a",
      placeName: "Farm Pond, OH",
      latitude: 40.212,
      longitude: -82.891,
    });
    const b = catchOf({
      id: "b",
      placeName: "Farm Pond, OH",
      latitude: 40.213,
      longitude: -82.89,
      caughtAt: "2025-06-22T19:05:00.000Z",
    });
    const spots = groupSpots([a, b]);
    expect(spots).toHaveLength(1);
    expect(spots[0].catchCount).toBe(2);
  });

  it("keeps same-day fish totals on separate spots", () => {
    const dawn = catchOf({
      id: "dawn",
      placeName: "Pace Bend, Lake Travis, TX",
      latitude: 30.458,
      longitude: -98.012,
      fishCount: 2,
      caughtAt: "2025-07-12T12:15:00.000Z",
    });
    const afternoon = catchOf({
      id: "afternoon",
      placeName: "Lake Travis, TX",
      latitude: 30.388,
      longitude: -97.975,
      fishCount: 5,
      caughtAt: "2025-07-12T20:40:00.000Z",
    });
    const spots = groupSpots([dawn, afternoon]);
    expect(spots).toHaveLength(2);
    expect(spots.find((s) => s.placeName.includes("Pace Bend"))?.fishCount).toBe(2);
    expect(spots.find((s) => s.placeName === "Lake Travis, TX")?.fishCount).toBe(5);
  });
});
