import { describe, expect, it } from "vitest";
import { catchInputFromUnknown } from "./parse";

describe("catchInputFromUnknown time of day", () => {
  it("keeps an explicit bucket from the client", () => {
    const input = catchInputFromUnknown({
      species: "Largemouth Bass",
      caughtAt: "2025-07-12T11:10:00.000Z",
      timeOfDay: "dawn",
    });
    expect(input.timeOfDay).toBe("dawn");
  });

  it("derives dawn from a datetime-local photo clock when the bucket is omitted", () => {
    const input = catchInputFromUnknown({
      species: "Largemouth Bass",
      caughtAt: "2025-07-12T06:10",
    });
    expect(input.timeOfDay).toBe("dawn");
    expect(input.season).toBe("summer");
  });
});

describe("catchInputFromUnknown without a species", () => {
  it("keeps a photo and pin when species is omitted", () => {
    const input = catchInputFromUnknown({
      photoPath: "uploads/live.jpg",
      latitude: 29.15,
      longitude: -96.88,
      caughtAt: "2025-07-12T11:10:00.000Z",
    });
    expect(input.species).toBe("Unknown");
    expect(input.photoPath).toBe("uploads/live.jpg");
    expect(input.latitude).toBe(29.15);
    expect(input.longitude).toBe(-96.88);
  });
});

describe("catchInputFromUnknown duck habitat", () => {
  it("keeps a Pintail log on the duck category", () => {
    const input = catchInputFromUnknown({
      species: "Pintail",
      speciesList: ["Pintail"],
      habitat: "duck",
      caughtAt: "2025-11-12T14:10:00.000Z",
      latitude: 29.15,
      longitude: -96.88,
    });
    expect(input.species).toBe("Pintail");
    expect(input.speciesList).toEqual(["Pintail"]);
    expect(input.habitat).toBe("duck");
  });

  it("infers duck when habitat is omitted for a catalog duck", () => {
    const input = catchInputFromUnknown({
      species: "Bluebill",
      caughtAt: "2025-11-12T14:10:00.000Z",
    });
    expect(input.habitat).toBe("duck");
  });
});

describe("catchInputFromUnknown species counts", () => {
  it("keeps a distinct count per tagged species", () => {
    const input = catchInputFromUnknown({
      species: "Redfish",
      speciesList: ["Redfish", "Speckled Trout"],
      caughtAt: "2025-07-12T11:10:00.000Z",
      speciesCounts: [
        { species: "Redfish", count: 2 },
        { species: "Speckled Trout", count: 3 },
      ],
    });
    expect(input.fishCount).toBe(5);
    expect(input.speciesCounts).toEqual([
      { species: "Redfish", count: 2 },
      { species: "Speckled Trout", count: 3 },
    ]);
  });
});
