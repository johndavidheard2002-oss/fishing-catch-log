import { describe, expect, it } from "vitest";
import {
  catchPinFromPhotoGps,
  classifyCatchPinEdit,
  coordsLookDifferent,
  shouldApplyPhotoGpsToCatch,
} from "./location";

describe("shouldApplyPhotoGpsToCatch", () => {
  it("fills the catch pin from the photo until the angler moves it", () => {
    expect(shouldApplyPhotoGpsToCatch(false)).toBe(true);
    expect(shouldApplyPhotoGpsToCatch(true)).toBe(false);
  });
});

describe("catchPinFromPhotoGps", () => {
  it("auto-places the catch pin from photo GPS", () => {
    expect(
      catchPinFromPhotoGps({
        photoLat: 28.74,
        photoLon: -80.75,
        userMovedCatchPin: false,
      }),
    ).toEqual({ latitude: "28.74", longitude: "-80.75" });
  });

  it("still applies photo GPS over an earlier auto-fill (device pin, same form)", () => {
    expect(
      catchPinFromPhotoGps({
        photoLat: 28.74,
        photoLon: -80.75,
        userMovedCatchPin: false,
      }),
    ).toEqual({ latitude: "28.74", longitude: "-80.75" });
  });

  it("does not overwrite a pin the angler already moved", () => {
    expect(
      catchPinFromPhotoGps({
        photoLat: 28.74,
        photoLon: -80.75,
        userMovedCatchPin: true,
      }),
    ).toBeNull();
  });

  it("leaves the pin empty when the photo has no GPS", () => {
    expect(
      catchPinFromPhotoGps({
        photoLat: null,
        photoLon: null,
        userMovedCatchPin: false,
      }),
    ).toBeNull();
  });
});

describe("classifyCatchPinEdit", () => {
  it("does not treat a tiny edit as moving off the photo stamp", () => {
    expect(
      classifyCatchPinEdit({
        nextLat: 30.3935,
        nextLon: -97.9242,
        photoLat: 30.3935,
        photoLon: -97.9242,
      }),
    ).toBe("matches-photo");
    expect(
      classifyCatchPinEdit({
        nextLat: 30.3936,
        nextLon: -97.9242,
        photoLat: 30.3935,
        photoLon: -97.9242,
      }),
    ).toBe("matches-photo");
  });

  it("marks a real coordinate change as a user-moved pin", () => {
    expect(
      classifyCatchPinEdit({
        nextLat: 30.5,
        nextLon: -97.9242,
        photoLat: 30.3935,
        photoLon: -97.9242,
      }),
    ).toBe("user-moved");
  });
});

describe("coordsLookDifferent", () => {
  it("treats the truck vs the water as different pins", () => {
    expect(coordsLookDifferent(28.74, -80.75, 28.74, -80.75)).toBe(false);
    expect(coordsLookDifferent(28.74, -80.75, 28.8, -80.7)).toBe(true);
    expect(coordsLookDifferent(28.74, -80.75, null, null)).toBe(false);
  });
});
