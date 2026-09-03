import { describe, expect, it, vi } from "vitest";
import {
  ALLOW_LOCATION_LABEL,
  SKIP_LOCATION_LABEL,
  catchPinFromPhotoGps,
  classifyCatchPinEdit,
  coordsLookDifferent,
  clearSavedLiveLocation,
  liveLocationPromptCopy,
  queryGeolocationPermission,
  readSavedLiveLocation,
  readSavedLiveLocationStatus,
  refreshLiveLocationIfGranted,
  requestDeviceGps,
  requestLiveLocationFromGesture,
  resolveCatchPinAfterPhotoAnswer,
  resolveLiveCameraCatchPin,
  shouldApplyPhotoGpsToCatch,
  shouldAutoPlaceCatchPin,
  writeSavedLiveLocation,
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

describe("liveLocationPromptCopy", () => {
  it("asks for location after sign-in, not from Camera, and never says buddy", () => {
    const prompt = liveLocationPromptCopy("prompt");
    expect(prompt.title).toBe("Allow location");
    expect(prompt.body).toContain("before Camera");
    expect(prompt.body).toContain("live photo");
    expect(prompt.body.toLowerCase()).not.toContain("buddy");
    expect(ALLOW_LOCATION_LABEL).toBe("Allow location");
    expect(SKIP_LOCATION_LABEL).toBe("Not now");
    expect(liveLocationPromptCopy("ready").title).toBe("Location on");
    expect(liveLocationPromptCopy("unavailable").body).toContain("Camera still works");
  });
});

describe("queryGeolocationPermission", () => {
  it("returns granted, prompt, denied, or unknown", async () => {
    await expect(
      queryGeolocationPermission({ query: async () => ({ state: "granted" }) }),
    ).resolves.toBe("granted");
    await expect(
      queryGeolocationPermission({ query: async () => ({ state: "prompt" }) }),
    ).resolves.toBe("prompt");
    await expect(
      queryGeolocationPermission({ query: async () => ({ state: "denied" }) }),
    ).resolves.toBe("denied");
    await expect(queryGeolocationPermission(null)).resolves.toBe("unknown");
    await expect(
      queryGeolocationPermission({
        query: async () => {
          throw new Error("unsupported");
        },
      }),
    ).resolves.toBe("unknown");
  });
});

describe("refreshLiveLocationIfGranted", () => {
  it("refreshes GPS only when location was already allowed", async () => {
    const getCurrentPosition = vi.fn(
      (success: (position: { coords: { latitude: number; longitude: number } }) => void) => {
        success({ coords: { latitude: 29.15, longitude: -96.88 } });
      },
    );
    await expect(
      refreshLiveLocationIfGranted({
        geolocation: { getCurrentPosition },
        permissions: { query: async () => ({ state: "granted" }) },
      }),
    ).resolves.toEqual({ latitude: 29.15, longitude: -96.88 });
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });

  it("does not call getCurrentPosition while iPhone still needs a tap", async () => {
    const getCurrentPosition = vi.fn();
    await expect(
      refreshLiveLocationIfGranted({
        geolocation: { getCurrentPosition },
        permissions: { query: async () => ({ state: "prompt" }) },
      }),
    ).resolves.toBeNull();
    await expect(
      refreshLiveLocationIfGranted({
        geolocation: { getCurrentPosition },
        permissions: { query: async () => ({ state: "denied" }) },
      }),
    ).resolves.toBeNull();
    await expect(
      refreshLiveLocationIfGranted({
        geolocation: { getCurrentPosition },
        permissions: null,
      }),
    ).resolves.toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe("saved live location", () => {
  it("remembers sign-in GPS for later Camera pins, or skip", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return memory.has(key) ? memory.get(key)! : null;
      },
      setItem(key: string, value: string) {
        memory.set(key, value);
      },
      removeItem(key: string) {
        memory.delete(key);
      },
    } as Storage;

    expect(readSavedLiveLocation(storage)).toBeNull();
    expect(readSavedLiveLocationStatus(storage)).toBeNull();
    writeSavedLiveLocation({ latitude: 29.15, longitude: -96.88 }, storage);
    expect(readSavedLiveLocation(storage)).toEqual({ latitude: 29.15, longitude: -96.88 });
    expect(readSavedLiveLocationStatus(storage)).toBe("ready");
    writeSavedLiveLocation(null, storage);
    expect(readSavedLiveLocation(storage)).toBeNull();
    expect(readSavedLiveLocationStatus(storage)).toBe("unavailable");
    clearSavedLiveLocation(storage);
    expect(readSavedLiveLocationStatus(storage)).toBeNull();
  });
});

describe("requestLiveLocationFromGesture", () => {
  it("starts getCurrentPosition in the same turn as the Allow location tap", async () => {
    let started = false;
    let release!: (gps: { coords: { latitude: number; longitude: number } }) => void;
    const held = new Promise<{ coords: { latitude: number; longitude: number } }>((resolve) => {
      release = resolve;
    });
    const geo = {
      getCurrentPosition(
        success: (position: { coords: { latitude: number; longitude: number } }) => void,
      ) {
        started = true;
        void held.then(success);
      },
    };
    const pending = requestLiveLocationFromGesture(geo);
    expect(started).toBe(true);
    release({ coords: { latitude: 29.15, longitude: -96.88 } });
    await expect(pending).resolves.toEqual({ latitude: 29.15, longitude: -96.88 });
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
