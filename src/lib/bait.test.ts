import { describe, expect, it } from "vitest";
import { BAIT_CATALOG, groupBaitSpots, parseBaitSpotInput, parseBaitTypes } from "./bait";
import type { BaitSpot } from "./types";

function bait(partial: Partial<BaitSpot> & { id: string }): BaitSpot {
  return {
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
    ...partial,
  };
}

describe("parseBaitTypes", () => {
  it("dedupes and caps bait names", () => {
    expect(parseBaitTypes(["Shrimp", "shrimp", " Finger mullet ", ""])).toEqual([
      "Shrimp",
      "Finger mullet",
    ]);
    expect(parseBaitTypes("Shrimp,Shad")).toEqual(["Shrimp", "Shad"]);
  });
});

describe("BAIT_CATALOG", () => {
  it("lists current live baits and drops retired names", () => {
    expect(BAIT_CATALOG).toEqual([
      "Shrimp",
      "Finger mullet",
      "Shad",
      "Croaker",
      "Piggy perch",
      "Pinfish",
      "Crabs",
      "Sand fleas",
      "Squid",
      "Cut bait",
    ]);
    expect(BAIT_CATALOG).toContain("Shad");
    expect(BAIT_CATALOG).toContain("Piggy perch");
    expect(BAIT_CATALOG).not.toContain("Pogies");
    expect(BAIT_CATALOG).not.toContain("Pilchards");
    expect(BAIT_CATALOG).not.toContain("Whitebait");
  });
});

describe("parseBaitSpotInput", () => {
  it("requires a bait type and a map pin", () => {
    expect(parseBaitSpotInput({ placeName: "The Point", latitude: 28.7, longitude: -80.7 })).toBeNull();
    expect(parseBaitSpotInput({ baitTypes: ["Shrimp"], placeName: "The Point" })).toBeNull();
    const parsed = parseBaitSpotInput({
      baitTypes: ["Shrimp"],
      placeName: "  Haulover Canal  ",
      latitude: 28.735,
      longitude: -80.754,
      loggedAt: "2026-08-02T14:00:00.000Z",
    });
    expect(parsed?.baitTypes).toEqual(["Shrimp"]);
    expect(parsed?.placeName).toBe("Haulover Canal");
    expect(parsed?.latitude).toBe(28.735);
  });
});

describe("groupBaitSpots", () => {
  it("keeps distant pins separate even with the same area name", () => {
    const groups = groupBaitSpots([
      bait({ id: "a", latitude: 28.735, longitude: -80.754 }),
      bait({
        id: "b",
        latitude: 28.4,
        longitude: -80.6,
        loggedAt: "2026-08-03T14:00:00.000Z",
      }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("clusters nearby visits of the same hole", () => {
    const groups = groupBaitSpots([
      bait({ id: "a", latitude: 28.735, longitude: -80.754 }),
      bait({
        id: "b",
        latitude: 28.7355,
        longitude: -80.7542,
        baitTypes: ["Finger mullet"],
        loggedAt: "2026-08-04T14:00:00.000Z",
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].visitCount).toBe(2);
    expect(groups[0].baitTypes).toEqual(expect.arrayContaining(["Shrimp", "Finger mullet"]));
  });
});
