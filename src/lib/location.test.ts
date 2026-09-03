import { describe, expect, it } from "vitest";
import {
  catchPinFromPhotoGps,
  classifyCatchPinEdit,
  coordsLookDifferent,
  resolveCatchPinAfterPhotoAnswer,
  shouldApplyPhotoGpsToCatch,
  shouldAutoPlaceCatchPin,
} from "./location";

describe("shouldApplyPhotoGpsToCatch", () => {
  it("fills the catch pin from the photo until the angler moves it", () => {
    expect(shouldApplyPhotoGpsToCatch(false)).toBe(true);
    expect(shouldApplyPhotoGpsToCatch(true)).toBe(false);
  });
});

describe("shouldAutoPlaceCatchPin", () => {
  it("does not auto-place until the angler says the photo was taken at the catch", () => {
    expect(shouldAutoPlaceCatchPin({ photoTakenAtCatch: null, userMovedCatchPin: false })).toBe(false);
    expect(shouldAutoPlaceCatchPin({ photoTakenAtCatch: false, userMovedCatchPin: false })).toBe(false);
  });

  it("auto-places on Yes when the pin was not already moved", () => {
    expect(shouldAutoPlaceCatchPin({ photoTakenAtCatch: true, userMovedCatchPin: false })).toBe(true);
  });

  it("still will not overwrite a pin the angler already moved", () => {
    expect(shouldAutoPlaceCatchPin({ photoTakenAtCatch: true, userMovedCatchPin: true })).toBe(false);
  });
});

describe("resolveCatchPinAfterPhotoAnswer", () => {
  const photoGps = { latitude: 28.74, longitude: -80.75 };
  const deviceGps = { latitude: 29.15, longitude: -96.88 };

  it("does nothing before they answer, and nothing on No", () => {
    expect(
      resolveCatchPinAfterPhotoAnswer({
        photoTakenAtCatch: null,
        userMovedCatchPin: false,
        photoGps,
        deviceGps,
        pastMode: false,
      }),
    ).toBeNull();
    expect(
      resolveCatchPinAfterPhotoAnswer({
        photoTakenAtCatch: false,
        userMovedCatchPin: false,
        photoGps,
        deviceGps,
        pastMode: false,
      }),
    ).toBeNull();
  });

  it("on Yes uses photo EXIF GPS before device GPS", () => {
    expect(
      resolveCatchPinAfterPhotoAnswer({
        photoTakenAtCatch: true,
        userMovedCatchPin: false,
        photoGps,
        deviceGps,
        pastMode: false,
      }),
    ).toEqual({ ...photoGps, source: "photo" });
  });

  it("on Yes with no photo GPS uses device GPS when not in past mode", () => {
    expect(
      resolveCatchPinAfterPhotoAnswer({
        photoTakenAtCatch: true,
        userMovedCatchPin: false,
        photoGps: null,
        deviceGps,
        pastMode: false,
      }),
    ).toEqual({ ...deviceGps, source: "device" });
  });

  it("on Yes in past mode does not fill from device GPS", () => {
    expect(
      resolveCatchPinAfterPhotoAnswer({
        photoTakenAtCatch: true,
        userMovedCatchPin: false,
        photoGps: null,
        deviceGps,
        pastMode: true,
      }),
    ).toBeNull();
  });

  it("on Yes still keeps a user-moved pin", () => {
    expect(
      resolveCatchPinAfterPhotoAnswer({
        photoTakenAtCatch: true,
        userMovedCatchPin: true,
        photoGps,
        deviceGps,
        pastMode: false,
      }),
    ).toBeNull();
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
