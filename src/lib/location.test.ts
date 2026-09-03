import { describe, expect, it, vi } from "vitest";
import {
  awaitLiveLocationThenOpenCamera,
  catchPinFromPhotoGps,
  classifyCatchPinEdit,
  coordsLookDifferent,
  requestDeviceGps,
  resolveCatchPinAfterPhotoAnswer,
  resolveLiveCameraCatchPin,
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

describe("requestDeviceGps", () => {
  it("returns coords when the phone shares a location", async () => {
    const geo = {
      getCurrentPosition(
        success: (position: { coords: { latitude: number; longitude: number } }) => void,
      ) {
        success({ coords: { latitude: 29.15, longitude: -96.88 } });
      },
    };
    await expect(requestDeviceGps(geo)).resolves.toEqual({ latitude: 29.15, longitude: -96.88 });
  });

  it("returns null when location is denied, times out, or is missing", async () => {
    const denied = {
      getCurrentPosition(
        _success: (position: { coords: { latitude: number; longitude: number } }) => void,
        error?: () => void,
      ) {
        error?.();
      },
    };
    await expect(requestDeviceGps(denied)).resolves.toBeNull();
    await expect(requestDeviceGps(null)).resolves.toBeNull();
  });
});

describe("awaitLiveLocationThenOpenCamera", () => {
  it("waits for location, then opens the camera", async () => {
    const order: string[] = [];
    await awaitLiveLocationThenOpenCamera({
      requestLocation: async () => {
        order.push("location");
      },
      openCamera: () => {
        order.push("camera");
      },
    });
    expect(order).toEqual(["location", "camera"]);
  });

  it("still opens the camera when location is denied or times out", async () => {
    const openCamera = vi.fn();
    await awaitLiveLocationThenOpenCamera({
      requestLocation: async () => null,
      openCamera,
    });
    expect(openCamera).toHaveBeenCalledOnce();

    openCamera.mockClear();
    await awaitLiveLocationThenOpenCamera({
      requestLocation: async () => {
        throw new Error("timeout");
      },
      openCamera,
    });
    expect(openCamera).toHaveBeenCalledOnce();
  });

  it("opens the camera when there is no live location hook (camera roll / bait)", async () => {
    const openCamera = vi.fn();
    await awaitLiveLocationThenOpenCamera({ openCamera });
    expect(openCamera).toHaveBeenCalledOnce();
  });

  it("opens the camera in the same tap after location was already asked", async () => {
    const requestLocation = vi.fn();
    const openCamera = vi.fn();
    await awaitLiveLocationThenOpenCamera({
      alreadyAsked: true,
      requestLocation,
      openCamera,
    });
    expect(requestLocation).not.toHaveBeenCalled();
    expect(openCamera).toHaveBeenCalledOnce();
  });

  it("starts the location request in the same turn as the tap, before the camera", async () => {
    let started = false;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const openCamera = vi.fn();
    const pending = awaitLiveLocationThenOpenCamera({
      requestLocation: () => {
        started = true;
        return held;
      },
      openCamera,
    });
    expect(started).toBe(true);
    expect(openCamera).not.toHaveBeenCalled();
    release();
    await pending;
    expect(openCamera).toHaveBeenCalledOnce();
  });
});

describe("resolveLiveCameraCatchPin", () => {
  const deviceGps = { latitude: 29.15, longitude: -96.88 };

  it("pins from this phone when location is allowed and the pin was not moved", () => {
    expect(resolveLiveCameraCatchPin({ userMovedCatchPin: false, deviceGps })).toEqual({
      ...deviceGps,
      source: "device",
    });
  });

  it("does nothing when location is denied", () => {
    expect(resolveLiveCameraCatchPin({ userMovedCatchPin: false, deviceGps: null })).toBeNull();
  });

  it("does not overwrite a pin the angler already moved", () => {
    expect(resolveLiveCameraCatchPin({ userMovedCatchPin: true, deviceGps })).toBeNull();
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
