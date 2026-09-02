import { inferHabitat } from "./habitat";
import type { CatchRecord } from "./types";

export function catchOf(
  partial: Partial<CatchRecord> & { id: string },
): CatchRecord {
  const species = partial.species ?? "Largemouth Bass";
  return {
    photoPath: null,
    species,
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
    habitat: inferHabitat(species),
    anglerId: "you",
    sharedWithLinked: false,
    ownerName: "You",
    createdAt: "2025-07-12T20:00:00.000Z",
    updatedAt: "2025-07-12T20:00:00.000Z",
    ...partial,
  };
}
