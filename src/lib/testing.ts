import { inferHabitat } from "./habitat";
import type { CatchRecord } from "./types";

export function catchOf(
  partial: Partial<CatchRecord> & { id: string },
): CatchRecord {
  const species = partial.species ?? "Largemouth Bass";
  const speciesList = partial.speciesList ?? [species];
  return {
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
    waterClarity: null,
    habitat: inferHabitat(species),
    fishCount: 1,
    anglerId: "you",
    sharedWithLinked: false,
    ownerName: "You",
    createdAt: "2025-07-12T20:00:00.000Z",
    updatedAt: "2025-07-12T20:00:00.000Z",
    ...partial,
  };
}
