import { describe, expect, it } from "vitest";
import {
  baitGroupThumbSrc,
  catchGroupThumbSrc,
  catchRecordThumbSrc,
  speciesPlaceholderSrc,
} from "./spot-thumbs";
import { catchOf } from "./testing";
import type { BaitSpotGroup } from "./types";

describe("speciesPlaceholderSrc", () => {
  it("maps saltwater names to seed art", () => {
    expect(speciesPlaceholderSrc(["Slot redfish"])).toBe("/seed/redfish.svg");
    expect(speciesPlaceholderSrc("Speckled Trout")).toBe("/seed/speckled.svg");
    expect(speciesPlaceholderSrc(["Mahi-mahi"])).toBe("/seed/mahi.svg");
  });

  it("returns null for unknown names", () => {
    expect(speciesPlaceholderSrc(["Snook"])).toBeNull();
  });
});

describe("catch thumbs", () => {
  it("prefers a logged photo over a species placeholder", () => {
    const record = catchOf({
      id: "c1",
      species: "Redfish",
      speciesList: ["Redfish"],
      photoPath: "catch.jpg",
    });
    expect(catchRecordThumbSrc(record)).toBe("/api/media/catch.jpg");
    expect(
      catchGroupThumbSrc({
        key: "k",
        placeName: "Pass",
        latitude: 29,
        longitude: -95,
        catchCount: 1,
        fishCount: 1,
        species: ["Redfish"],
        speciesCounts: [{ species: "Redfish", count: 1 }],
        lastCaughtAt: record.caughtAt,
        typicalCondition: null,
        typicalTime: null,
        avgTempF: null,
        catches: [record],
      }),
    ).toBe("/api/media/catch.jpg");
  });

  it("falls back to species seed art", () => {
    const record = catchOf({ id: "c2", species: "Redfish", speciesList: ["Redfish"], photoPath: null });
    expect(catchRecordThumbSrc(record)).toBe("/seed/redfish.svg");
  });
});

describe("baitGroupThumbSrc", () => {
  it("uses the first bait photo when present", () => {
    const group = {
      key: "b",
      placeName: "Pass",
      latitude: 29,
      longitude: -95,
      visitCount: 1,
      baitTypes: ["Shrimp"],
      lastLoggedAt: "2025-07-12T20:00:00.000Z",
      typicalCondition: null,
      typicalTime: null,
      avgTempF: null,
      spots: [
        {
          id: "bs1",
          photoPath: "shrimp.jpg",
          placeName: "Pass",
          baitTypes: ["Shrimp"],
          latitude: 29,
          longitude: -95,
          temperatureF: null,
          weatherCondition: null,
          windSpeedMph: null,
          windDirection: null,
          precipitationIn: null,
          humidity: null,
          moonPhase: null,
          moonIllumination: null,
          pressureInHg: null,
          pressureMb: null,
          pressureTrend: null,
          loggedAt: "2025-07-12T20:00:00.000Z",
          timeOfDay: "afternoon",
          season: "summer",
          notes: null,
          tide: null,
          tideHeightFt: null,
          tideDetail: null,
          habitat: "saltwater-inshore",
          anglerId: "me",
          sharedWithLinked: false,
          ownerName: "You",
          createdAt: "2025-07-12T20:00:00.000Z",
          updatedAt: "2025-07-12T20:00:00.000Z",
        },
      ],
    } as BaitSpotGroup;
    expect(baitGroupThumbSrc(group)).toBe("/api/media/shrimp.jpg");
  });
});
