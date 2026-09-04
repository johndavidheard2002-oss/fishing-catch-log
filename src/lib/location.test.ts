import { describe, expect, it, vi } from "vitest";
import {
  ALLOW_GPS_BUDGET_MS,
  ALLOW_GPS_FALLBACK_OPTIONS,
  ALLOW_GPS_OPTIONS,
  ALLOW_LOCATION_LABEL,
  CONTINUE_WITHOUT_LOCATION_LABEL,
  DROPPING_PIN_HINT,
  GETTING_LOCATION_LABEL,
  SKIP_LOCATION_LABEL,
  persistAllowLocationOutcome,
  skipLocationLabel,
  waitForAllowLocationFix,
  catchPinFromPhotoGps,
  classifyCatchPinEdit,
  classifyGpsError,
  coordsLookDifferent,
  clearSavedLiveLocation,
  initialLiveLocationStatusFromSaved,
  liveLocationPromptCopy,
  LOCATION_OFF_PIN_HINT,
  queryGeolocationPermission,
  readSavedLiveLocation,
  readSavedLiveLocationStatus,
  refreshLiveLocationIfGranted,
  requestDeviceGps,
  requestDeviceGpsAttempt,
  requestLiveLocationFromGesture,
  resolveCatchPinAfterPhotoAnswer,
  resolveLiveCameraCatchPin,
  resolveLiveCameraDeviceGps,
  resolveLiveCameraPinAfterPhoto,
  shouldApplyPhotoGpsToCatch,
  shouldAutoPlaceCatchPin,
  waitForLiveLocationFix,
  writeSavedLiveLocation,
  writeSavedLiveLocationAllowed,
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
    expect(prompt.body).toContain("live photo");
    expect(prompt.body).toContain("pin on the water");
    expect(prompt.body).toContain("You can still move the pin");
    expect(prompt.body.toLowerCase()).not.toContain("buddy");
    expect(ALLOW_LOCATION_LABEL).toBe("Allow location");
    expect(SKIP_LOCATION_LABEL).toBe("Not now");
    expect(CONTINUE_WITHOUT_LOCATION_LABEL).toBe("Continue without location");
    expect(skipLocationLabel("prompt")).toBe("Not now");
    expect(skipLocationLabel("asking")).toBe("Continue without location");
    expect(GETTING_LOCATION_LABEL).toBe("Getting location…");
    expect(DROPPING_PIN_HINT).toBe("Dropping pin from this phone…");
    expect(liveLocationPromptCopy("ready").title).toBe("Location on");
    expect(liveLocationPromptCopy("unavailable").body).toContain("Camera still works");
    expect(liveLocationPromptCopy("asking").title).toBe("Getting location…");
    expect(liveLocationPromptCopy("asking").body).toContain("finding where you are");
    expect(liveLocationPromptCopy("asking").body).toContain("Continue without location");
    expect(liveLocationPromptCopy("asking").body.toLowerCase()).not.toContain("buddy");
  });
});

describe("initialLiveLocationStatusFromSaved", () => {
  it("does not treat Allow-without-coords as ready", () => {
    expect(initialLiveLocationStatusFromSaved("ready")).toBe("ready");
    expect(initialLiveLocationStatusFromSaved("allowed")).toBe("asking");
    expect(initialLiveLocationStatusFromSaved("unavailable")).toBe("unavailable");
    expect(initialLiveLocationStatusFromSaved(null)).toBe("prompt");
  });
});

describe("classifyGpsError", () => {
  it("tells deny apart from a slow reading", () => {
    expect(classifyGpsError({ code: 1 })).toBe("denied");
    expect(classifyGpsError({ code: 3 })).toBe("timeout");
    expect(classifyGpsError({ code: 2 })).toBe("unavailable");
    expect(classifyGpsError()).toBe("unavailable");
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
        savedStatus: null,
      }),
    ).resolves.toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("refreshes GPS after sign-in Allow even when iPhone cannot report granted", async () => {
    const getCurrentPosition = vi.fn(
      (success: (position: { coords: { latitude: number; longitude: number } }) => void) => {
        success({ coords: { latitude: 29.15, longitude: -96.88 } });
      },
    );
    await expect(
      refreshLiveLocationIfGranted({
        geolocation: { getCurrentPosition },
        permissions: { query: async () => ({ state: "prompt" }) },
        savedStatus: "allowed",
      }),
    ).resolves.toEqual({ latitude: 29.15, longitude: -96.88 });
    await expect(
      refreshLiveLocationIfGranted({
        geolocation: { getCurrentPosition },
        permissions: null,
        savedStatus: "ready",
      }),
    ).resolves.toEqual({ latitude: 29.15, longitude: -96.88 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
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
    writeSavedLiveLocationAllowed(storage);
    expect(readSavedLiveLocation(storage)).toBeNull();
    expect(readSavedLiveLocationStatus(storage)).toBe("allowed");
    writeSavedLiveLocation({ latitude: 29.15, longitude: -96.88 }, storage);
    expect(readSavedLiveLocation(storage)).toEqual({ latitude: 29.15, longitude: -96.88 });
    expect(readSavedLiveLocationStatus(storage)).toBe("ready");
    writeSavedLiveLocationAllowed(storage);
    expect(readSavedLiveLocation(storage)).toEqual({ latitude: 29.15, longitude: -96.88 });
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

describe("resolveLiveCameraDeviceGps", () => {
  const savedGps = { latitude: 29.15, longitude: -96.88 };

  it("pins immediately from saved ready coords without waiting for a new GPS reading", async () => {
    const getCurrentPosition = vi.fn();
    await expect(
      resolveLiveCameraDeviceGps({
        savedGps,
        savedStatus: "ready",
        geolocation: { getCurrentPosition },
        permissions: { query: async () => ({ state: "prompt" }) },
      }),
    ).resolves.toEqual(savedGps);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("uses a saved pin even when the phone cannot report permission", async () => {
    const getCurrentPosition = vi.fn();
    await expect(
      resolveLiveCameraDeviceGps({
        savedGps,
        savedStatus: null,
        geolocation: { getCurrentPosition },
        permissions: null,
      }),
    ).resolves.toEqual(savedGps);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("keeps requesting GPS when allowed but no coords yet, then returns the fix", async () => {
    let calls = 0;
    const geo = {
      getCurrentPosition(
        success: (position: { coords: { latitude: number; longitude: number } }) => void,
        error?: (err?: { code?: number }) => void,
      ) {
        calls += 1;
        if (calls < 3) {
          error?.({ code: 3 });
          return;
        }
        success({ coords: { latitude: 28.4, longitude: -96.4 } });
      },
    };
    await expect(
      resolveLiveCameraDeviceGps({
        savedGps: null,
        savedStatus: "allowed",
        geolocation: geo,
        permissions: null,
        retryGapMs: 0,
      }),
    ).resolves.toEqual({ latitude: 28.4, longitude: -96.4 });
    expect(calls).toBe(3);
  });

  it("does not treat a skipped Allow as a live pin", async () => {
    const getCurrentPosition = vi.fn();
    await expect(
      resolveLiveCameraDeviceGps({
        savedGps: null,
        savedStatus: "unavailable",
        geolocation: { getCurrentPosition },
        permissions: { query: async () => ({ state: "denied" }) },
      }),
    ).resolves.toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe("resolveLiveCameraPinAfterPhoto", () => {
  const savedGps = { latitude: 29.15, longitude: -96.88 };

  it("pins from ready saved coords on a live Camera file", async () => {
    const getCurrentPosition = vi.fn();
    await expect(
      resolveLiveCameraPinAfterPhoto({
        userMovedCatchPin: false,
        savedGps,
        savedStatus: "ready",
        geolocation: { getCurrentPosition },
        permissions: null,
      }),
    ).resolves.toEqual({
      deviceGps: savedGps,
      pin: { ...savedGps, source: "device" },
    });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("eventually pins when Allow was saved without coords yet", async () => {
    let calls = 0;
    const geo = {
      getCurrentPosition(
        success: (position: { coords: { latitude: number; longitude: number } }) => void,
        error?: (err?: { code?: number }) => void,
      ) {
        calls += 1;
        if (calls < 2) {
          error?.({ code: 3 });
          return;
        }
        success({ coords: { latitude: 29.15, longitude: -96.88 } });
      },
    };
    await expect(
      resolveLiveCameraPinAfterPhoto({
        userMovedCatchPin: false,
        savedGps: null,
        savedStatus: "allowed",
        geolocation: geo,
        permissions: { query: async () => ({ state: "prompt" }) },
        retryGapMs: 0,
      }),
    ).resolves.toEqual({
      deviceGps: savedGps,
      pin: { ...savedGps, source: "device" },
    });
    expect(calls).toBeGreaterThan(1);
  });

  it("does not auto-pin when they denied or skipped location", async () => {
    const getCurrentPosition = vi.fn();
    await expect(
      resolveLiveCameraPinAfterPhoto({
        userMovedCatchPin: false,
        savedGps: null,
        savedStatus: "unavailable",
        geolocation: { getCurrentPosition },
        permissions: { query: async () => ({ state: "denied" }) },
      }),
    ).resolves.toEqual({ deviceGps: null, pin: null });
    await expect(
      resolveLiveCameraPinAfterPhoto({
        userMovedCatchPin: false,
        savedGps: null,
        savedStatus: null,
        geolocation: { getCurrentPosition },
        permissions: { query: async () => ({ state: "denied" }) },
      }),
    ).resolves.toEqual({ deviceGps: null, pin: null });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe("waitForLiveLocationFix", () => {
  it("retries after timeout until a fix arrives", async () => {
    let calls = 0;
    const geo = {
      getCurrentPosition(
        success: (position: { coords: { latitude: number; longitude: number } }) => void,
        error?: (err?: { code?: number }) => void,
      ) {
        calls += 1;
        if (calls === 1) {
          error?.({ code: 3 });
          return;
        }
        success({ coords: { latitude: 29.15, longitude: -96.88 } });
      },
    };
    await expect(
      waitForLiveLocationFix({ geolocation: geo, retryGapMs: 0, budgetMs: 20_000 }),
    ).resolves.toEqual({ ok: true, gps: { latitude: 29.15, longitude: -96.88 } });
    expect(calls).toBe(2);
  });

  it("stops on permission denied and does not keep asking", async () => {
    const getCurrentPosition = vi.fn(
      (
        _success: (position: { coords: { latitude: number; longitude: number } }) => void,
        error?: (err?: { code?: number }) => void,
      ) => {
        error?.({ code: 1 });
      },
    );
    await expect(
      waitForLiveLocationFix({
        geolocation: { getCurrentPosition },
        retryGapMs: 0,
        budgetMs: 20_000,
      }),
    ).resolves.toEqual({ ok: false, reason: "denied" });
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });

  it("stops retrying after the camera budget", async () => {
    const getCurrentPosition = vi.fn(
      (
        _success: (position: { coords: { latitude: number; longitude: number } }) => void,
        error?: (err?: { code?: number }) => void,
      ) => {
        error?.({ code: 3 });
      },
    );
    await expect(
      waitForLiveLocationFix({
        geolocation: { getCurrentPosition },
        retryGapMs: 5,
        budgetMs: 20,
      }),
    ).resolves.toEqual({ ok: false, reason: "timeout" });
    expect(getCurrentPosition.mock.calls.length).toBeGreaterThan(1);
  });

  it("uses the Allow-tap firstAttempt so getCurrentPosition starts in that gesture", async () => {
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
    const first = requestDeviceGpsAttempt(geo);
    expect(started).toBe(true);
    const pending = waitForLiveLocationFix({ firstAttempt: first, geolocation: geo, retryGapMs: 0 });
    release({ coords: { latitude: 29.15, longitude: -96.88 } });
    await expect(pending).resolves.toEqual({
      ok: true,
      gps: { latitude: 29.15, longitude: -96.88 },
    });
  });

  it("caps a hanging getCurrentPosition so Allow cannot wait forever", async () => {
    const geo = {
      getCurrentPosition() {
        /* never succeeds and never returns denied */
      },
    };
    const started = Date.now();
    await expect(
      waitForLiveLocationFix({
        geolocation: geo,
        retryGapMs: 0,
        budgetMs: 30,
        options: { enableHighAccuracy: true, timeout: 10_000 },
      }),
    ).resolves.toEqual({ ok: false, reason: "timeout" });
    expect(Date.now() - started).toBeLessThan(500);
  });
});

function memoryStorage(): Storage {
  const memory = new Map<string, string>();
  return {
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
}

describe("persistAllowLocationOutcome", () => {
  it("Allow timeout enters journal without hanging", async () => {
    const storage = memoryStorage();
    const geo = {
      getCurrentPosition() {
        /* never succeeds and never returns denied */
      },
    };
    const started = Date.now();
    const result = await waitForAllowLocationFix({
      geolocation: geo,
      retryGapMs: 0,
      budgetMs: 35,
    });
    expect(Date.now() - started).toBeLessThan(500);
    expect(result).toEqual({ ok: false, reason: "timeout" });
    const outcome = persistAllowLocationOutcome(result, storage);
    expect(outcome).toEqual({ savedStatus: "allowed", enterJournal: true });
    expect(readSavedLiveLocationStatus(storage)).toBe("allowed");
    expect(readSavedLiveLocation(storage)).toBeNull();
  });

  it("Not now still unavailable", () => {
    const storage = memoryStorage();
    const outcome = persistAllowLocationOutcome({ skip: true }, storage);
    expect(outcome).toEqual({ savedStatus: "unavailable", enterJournal: true });
    expect(readSavedLiveLocationStatus(storage)).toBe("unavailable");
    expect(readSavedLiveLocation(storage)).toBeNull();
  });

  it("explicit deny is unavailable, not a leftover allowed hang", () => {
    const storage = memoryStorage();
    writeSavedLiveLocationAllowed(storage);
    const outcome = persistAllowLocationOutcome({ ok: false, reason: "denied" }, storage);
    expect(outcome).toEqual({ savedStatus: "unavailable", enterJournal: true });
    expect(readSavedLiveLocationStatus(storage)).toBe("unavailable");
  });

  it("success still ready", () => {
    const storage = memoryStorage();
    const gps = { latitude: 29.15, longitude: -96.88 };
    const outcome = persistAllowLocationOutcome({ ok: true, gps }, storage);
    expect(outcome).toEqual({ savedStatus: "ready", enterJournal: true });
    expect(readSavedLiveLocationStatus(storage)).toBe("ready");
    expect(readSavedLiveLocation(storage)).toEqual(gps);
  });
});

describe("waitForAllowLocationFix", () => {
  it("retries a slow high-accuracy try with a faster low-accuracy reading", async () => {
    const optionsSeen: PositionOptions[] = [];
    let calls = 0;
    const geo = {
      getCurrentPosition(
        success: (position: { coords: { latitude: number; longitude: number } }) => void,
        error?: (err?: { code?: number }) => void,
        options?: PositionOptions,
      ) {
        calls += 1;
        if (options) optionsSeen.push(options);
        if (calls === 1) {
          error?.({ code: 3 });
          return;
        }
        success({ coords: { latitude: 29.15, longitude: -96.88 } });
      },
    };
    const first = requestDeviceGpsAttempt(geo, ALLOW_GPS_OPTIONS);
    await expect(
      waitForAllowLocationFix({ firstAttempt: first, geolocation: geo, retryGapMs: 0 }),
    ).resolves.toEqual({ ok: true, gps: { latitude: 29.15, longitude: -96.88 } });
    expect(calls).toBe(2);
    expect(optionsSeen[0]?.enableHighAccuracy).toBe(true);
    expect(optionsSeen[1]?.enableHighAccuracy).toBe(false);
    expect(ALLOW_GPS_OPTIONS.enableHighAccuracy).toBe(true);
    expect(ALLOW_GPS_FALLBACK_OPTIONS.enableHighAccuracy).toBe(false);
    expect(ALLOW_GPS_BUDGET_MS).toBeGreaterThanOrEqual(12_000);
    expect(ALLOW_GPS_BUDGET_MS).toBeLessThanOrEqual(15_000);
  });
});

describe("LOCATION_OFF_PIN_HINT", () => {
  it("keeps the tap-the-map banner when a live pin could not be placed", () => {
    expect(LOCATION_OFF_PIN_HINT).toBe("Location was off. Tap the map to pin this catch.");
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

  it("on Yes in Backfill still pins from this phone when the file has no GPS", () => {
    expect(
      resolveCatchPinAfterPhotoAnswer({
        photoTakenAtCatch: true,
        userMovedCatchPin: false,
        photoGps: null,
        deviceGps,
        pastMode: true,
      }),
    ).toEqual({ ...deviceGps, source: "device" });
  });

  it("on Yes in Backfill still prefers photo EXIF GPS over this phone", () => {
    expect(
      resolveCatchPinAfterPhotoAnswer({
        photoTakenAtCatch: true,
        userMovedCatchPin: false,
        photoGps,
        deviceGps,
        pastMode: true,
      }),
    ).toEqual({ ...photoGps, source: "photo" });
  });

  it("on Yes does not invent a photo stamp when only the phone GPS is used", () => {
    const next = resolveCatchPinAfterPhotoAnswer({
      photoTakenAtCatch: true,
      userMovedCatchPin: false,
      photoGps: null,
      deviceGps,
      pastMode: true,
    });
    expect(next?.source).toBe("device");
    expect(next?.source).not.toBe("photo");
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
