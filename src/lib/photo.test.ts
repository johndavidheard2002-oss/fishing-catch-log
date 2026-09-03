import { describe, expect, it } from "vitest";
import { catchOf } from "./testing";
import { catchPhotoFilename, isPersonalPhoto, isSampleCatchPhoto, personalPhotoSrc, photoSrc, weatherLine } from "./photo";

describe("isSampleCatchPhoto", () => {
  it("recognizes built-in sample art only", () => {
    expect(isSampleCatchPhoto("/seed/largemouth.svg")).toBe(true);
    expect(isSampleCatchPhoto("abc123.jpg")).toBe(false);
    expect(isSampleCatchPhoto(null)).toBe(false);
  });
});

describe("isPersonalPhoto", () => {
  it("accepts uploaded journal files only", () => {
    expect(isPersonalPhoto("abc123.jpg")).toBe(true);
    expect(isPersonalPhoto("/seed/largemouth.svg")).toBe(false);
    expect(isPersonalPhoto("https://images.unsplash.com/photo")).toBe(false);
    expect(isPersonalPhoto(null)).toBe(false);
  });
});

describe("personalPhotoSrc", () => {
  it("does not surface seed or stock art", () => {
    expect(personalPhotoSrc("/seed/mahi.svg")).toBeNull();
    expect(photoSrc("/seed/mahi.svg")).toBe("/seed/mahi.svg");
    expect(personalPhotoSrc("trip.jpg")).toBe("/api/media/trip.jpg");
    expect(photoSrc("https://cdn.example/catch.jpg")).toBe("https://cdn.example/catch.jpg");
  });
});

describe("catchPhotoFilename", () => {
  it("builds a camera-roll name from species and date", () => {
    expect(
      catchPhotoFilename({
        species: "Redfish",
        caughtAt: "2024-06-12T13:40:00",
        photoPath: "abc.jpg",
      }),
    ).toBe("catch-compass-redfish-2024-06-12.jpg");
  });

  it("joins two tagged species and maps jpeg to jpg", () => {
    expect(
      catchPhotoFilename({
        species: ["Speckled Trout", "Redfish"],
        caughtAt: "2024-06-12T13:40:00.000Z",
        photoPath: "shot.JPEG",
      }),
    ).toBe("catch-compass-speckled-trout-redfish-2024-06-12.jpg");
  });
});

describe("weatherLine", () => {
  it("includes tide stage and next extremes on saltwater", () => {
    const line = weatherLine(
      catchOf({
        id: "salt-1",
        species: "Redfish",
        habitat: "saltwater-inshore",
        temperatureF: 84,
        weatherCondition: "clear",
        tide: "incoming",
        tideHeightFt: 1.2,
        tideDetail: "High 4:00 PM 2.8 ft · Low 10:00 PM 0.2 ft",
      }),
    );
    expect(line).toContain("Incoming 1.2 ft");
    expect(line).toContain("High 4:00 PM");
  });

  it("omits tide on freshwater even if a stage was stored", () => {
    const line = weatherLine(
      catchOf({
        id: "fresh-1",
        species: "Largemouth Bass",
        habitat: "freshwater",
        temperatureF: 80,
        weatherCondition: "clear",
        tide: "incoming",
        tideHeightFt: 1.2,
        tideDetail: "High 4:00 PM 2.8 ft",
      }),
    );
    expect(line).not.toMatch(/tide|Incoming|High 4:00/i);
  });
});
