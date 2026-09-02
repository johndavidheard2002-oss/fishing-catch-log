import { describe, expect, it } from "vitest";
import { catchPinFromPhotoGps, coordsLookDifferent, shouldApplyPhotoGpsToCatch } from "./location";

describe("shouldApplyPhotoGpsToCatch", () => {
  it("fills the catch pin from the photo only when the angler has not set a spot", () => {
    expect(shouldApplyPhotoGpsToCatch(false)).toBe(true);
    expect(shouldApplyPhotoGpsToCatch(true)).toBe(false);
  });
});

describe("catchPinFromPhotoGps", () => {
  it("auto-places the catch pin from photo GPS until the angler moves it", () => {
    expect(
      catchPinFromPhotoGps({
        photoLat: 28.74,
        photoLon: -80.75,
        catchLat: "",
        catchLon: "",
        catchLocationLocked: false,
      }),
    ).toEqual({ latitude: "28.74", longitude: "-80.75" });
    expect(
      catchPinFromPhotoGps({
        photoLat: 28.74,
        photoLon: -80.75,
        catchLat: "30.1",
        catchLon: "-97.9",
        catchLocationLocked: false,
      }),
    ).toBeNull();
    expect(
      catchPinFromPhotoGps({
        photoLat: 28.74,
        photoLon: -80.75,
        catchLocationLocked: true,
      }),
    ).toBeNull();
  });
});

describe("coordsLookDifferent", () => {
  it("treats the truck vs the water as different pins", () => {
    expect(coordsLookDifferent(28.74, -80.75, 28.74, -80.75)).toBe(false);
    expect(coordsLookDifferent(28.74, -80.75, 28.8, -80.7)).toBe(true);
    expect(coordsLookDifferent(28.74, -80.75, null, null)).toBe(false);
  });
});
