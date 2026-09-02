import { countsForCatch } from "./count";
import { inferHabitat } from "./habitat";
import type { BaitSpot, CatchRecord } from "./types";

export function catchOf(
  partial: Partial<CatchRecord> & { id: string },
): CatchRecord {
  const species = partial.species ?? "Largemouth Bass";
  const speciesList = partial.speciesList ?? [species];
  const record: CatchRecord = {
    photoPath: null,
    species,
    speciesList,
    speciesSuggested: null,
    speciesConfidence: null,
    speciesSource: "manual",
    latitude: 30.388,
    longitude: -97.975,
    photoTakenLatitude: null,
    photoTakenLongitude: null,
    placeName: "Lake Travis, TX",
    temperatureF: 80,
    weatherCondition: "clear",
    windSpeedMph: 6,
    windDirection: null,
    precipitationIn: 0,
    humidity: 50,
    moonPhase: null,
    moonIllumination: null,
    pressureInHg: null,
    pressureMb: null,
    pressureTrend: null,
    caughtAt: "2025-07-12T20:00:00.000Z",
    timeOfDay: "afternoon",
    season: "summer",
    notes: null,
    bait: null,
    tide: null,
    tideHeightFt: null,
    tideDetail: null,
    waterClarity: null,
    habitat: inferHabitat(species),
    fishCount: 1,
    speciesCounts: [],
    anglerId: "you",
    sharedWithLinked: false,
    ownerName: "You",
    createdAt: "2025-07-12T20:00:00.000Z",
    updatedAt: "2025-07-12T20:00:00.000Z",
    ...partial,
  };
  if (!partial.speciesCounts) {
    record.speciesCounts = countsForCatch({ ...record, speciesCounts: [] });
  }
  return record;
}

export function baitOf(partial: Partial<BaitSpot> & { id: string }): BaitSpot {
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
