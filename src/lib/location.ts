/** Photo GPS is often the cooler, dock, or truck — not the water. */

export type PinSource = "photo" | "device" | "manual";

export type PhotoGps = { latitude: number; longitude: number };

export const DROP_CATCH_PIN_HINT = "Drop a pin on the map for where you caught it.";

/** Used by live Log Camera so iPhone can show the location dialog before the camera sheet. */
export const LIVE_GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 60_000,
};

export type DeviceGeolocation = {
  getCurrentPosition: (
    success: (position: { coords: { latitude: number; longitude: number } }) => void,
    error?: () => void,
    options?: PositionOptions,
  ) => void;
};

/**
 * One-shot GPS. Errors, timeouts, and missing geolocation all resolve null
 * so live Log can still open the camera and let them drop a pin by hand.
 */
export function requestDeviceGps(
  geolocation: DeviceGeolocation | null | undefined = typeof navigator !== "undefined"
    ? navigator.geolocation
    : undefined,
  options: PositionOptions = LIVE_GPS_OPTIONS,
): Promise<PhotoGps | null> {
  if (!geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      options,
    );
  });
}

/**
 * Start this tap’s location request in the same turn (so iPhone shows the
 * system dialog), then open the camera after Allow / Deny / timeout.
 * Must not be an `async` function: Safari can drop user-activation if the
 * click handler is async, and the camera sheet then buries the dialog.
 */
export function awaitLiveLocationThenOpenCamera(args: {
  requestLocation?: () => void | Promise<unknown>;
  openCamera: () => void;
  alreadyAsked?: boolean;
}): Promise<void> {
  if (args.alreadyAsked || !args.requestLocation) {
    args.openCamera();
    return Promise.resolve();
  }
  let pending: Promise<unknown>;
  try {
    pending = Promise.resolve(args.requestLocation());
  } catch {
    args.openCamera();
    return Promise.resolve();
  }
  return pending.then(
    () => {
      args.openCamera();
    },
    () => {
      args.openCamera();
    },
  );
}

/** Auto-place from the photo unless the angler already moved this catch’s pin. */
export function shouldApplyPhotoGpsToCatch(userMovedCatchPin: boolean): boolean {
  return !userMovedCatchPin;
}

/**
 * Catch pin auto-fill waits for Yes — the photo was taken where they caught the fish —
 * and still will not overwrite a pin the angler already moved.
 */
export function shouldAutoPlaceCatchPin(args: {
  photoTakenAtCatch: boolean | null;
  userMovedCatchPin: boolean;
}): boolean {
  return args.photoTakenAtCatch === true && shouldApplyPhotoGpsToCatch(args.userMovedCatchPin);
}

/**
 * Live Log camera: pin from this phone now. Does not wait for Yes/No.
 * A user-moved pin is left alone. Denied location returns null.
 */
export function resolveLiveCameraCatchPin(args: {
  userMovedCatchPin: boolean;
  deviceGps: PhotoGps | null;
}): { latitude: number; longitude: number; source: "device" } | null {
  if (args.userMovedCatchPin) return null;
  if (!args.deviceGps) return null;
  return { ...args.deviceGps, source: "device" };
}

/**
 * After Yes: photo EXIF GPS first, else device GPS (not in past/backfill mode).
 * Unanswered, No, or a user-moved pin → no auto-place.
 */
export function resolveCatchPinAfterPhotoAnswer(args: {
  photoTakenAtCatch: boolean | null;
  userMovedCatchPin: boolean;
  photoGps: PhotoGps | null;
  deviceGps: PhotoGps | null;
  pastMode: boolean;
}): { latitude: number; longitude: number; source: PinSource } | null {
  if (
    !shouldAutoPlaceCatchPin({
      photoTakenAtCatch: args.photoTakenAtCatch,
      userMovedCatchPin: args.userMovedCatchPin,
    })
  ) {
    return null;
  }
  if (args.photoGps) {
    return { ...args.photoGps, source: "photo" };
  }
  if (!args.pastMode && args.deviceGps) {
    return { ...args.deviceGps, source: "device" };
  }
  return null;
}

/**
 * Photo GPS fills the catch pin when the angler has not moved it.
 * Device GPS or a prior auto-fill is replaced. A user-moved pin is not.
 */
export function catchPinFromPhotoGps(args: {
  photoLat: number | null | undefined;
  photoLon: number | null | undefined;
  userMovedCatchPin: boolean;
}): { latitude: string; longitude: string } | null {
  if (args.userMovedCatchPin) return null;
  if (args.photoLat == null || args.photoLon == null) return null;
  return { latitude: String(args.photoLat), longitude: String(args.photoLon) };
}

/** Typing coords that still match the photo stamp is not a user move. */
export function classifyCatchPinEdit(args: {
  nextLat: number;
  nextLon: number;
  photoLat: number | null | undefined;
  photoLon: number | null | undefined;
}): "matches-photo" | "user-moved" {
  if (
    args.photoLat != null &&
    args.photoLon != null &&
    !coordsLookDifferent(args.nextLat, args.nextLon, args.photoLat, args.photoLon)
  ) {
    return "matches-photo";
  }
  return "user-moved";
}

export function coordsLookDifferent(
  aLat: number | null | undefined,
  aLon: number | null | undefined,
  bLat: number | null | undefined,
  bLon: number | null | undefined,
  epsilon = 0.0008,
): boolean {
  if (aLat == null || aLon == null || bLat == null || bLon == null) return false;
  return Math.abs(aLat - bLat) > epsilon || Math.abs(aLon - bLon) > epsilon;
}

export function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}
