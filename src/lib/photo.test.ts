import { describe, expect, it } from "vitest";
import { catchPhotoFilename, isPersonalPhoto, personalPhotoSrc, photoSrc } from "./photo";

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
