/** Photo GPS is often the cooler, dock, or truck — not the water. */

export type PinSource = "photo" | "device" | "manual";

export type PhotoGps = { latitude: number; longitude: number };

export const DROP_CATCH_PIN_HINT = "Drop a pin on the map for where you caught it.";

/** Live Log GPS — asked on Log a catch open, never inside the Camera tap. */
export const LIVE_GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 60_000,
};

export type LiveLocationStatus = "prompt" | "asking" | "ready" | "unavailable";

export const ALLOW_LOCATION_LABEL = "Allow location";
export const SKIP_LOCATION_LABEL = "Not now";

export type DeviceGeolocation = {
  getCurrentPosition: (
    success: (position: { coords: { latitude: number; longitude: number } }) => void,
    error?: () => void,
    options?: PositionOptions,
  ) => void;
};

export type DevicePermissions = {
  query: (desc: { name: string }) => Promise<{ state: string }>;
};

export type GeolocationPermissionState = "granted" | "prompt" | "denied" | "unknown";

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

export function liveLocationPromptCopy(status: LiveLocationStatus): {
  title: string;
  body: string;
} {
  if (status === "ready") {
    return {
      title: "Location on",
      body: "A live photo will pin this catch. You can still move the pin.",
    };
  }
  if (status === "unavailable") {
    return {
      title: "Location off",
      body: "Camera still works. Drop a pin on the map for where you caught it.",
    };
  }
  if (status === "asking") {
    return {
      title: "Pin this catch",
      body: "Waiting for this phone’s location…",
    };
  }
  return {
    title: "Pin this catch",
    body: "Allow location so this phone can drop the pin. iPhone asks on that tap — before Camera. Skip and you can still take a photo and pin it by hand.",
  };
}

export async function queryGeolocationPermission(
  permissions: DevicePermissions | null | undefined =
    typeof navigator !== "undefined"
      ? (navigator.permissions as DevicePermissions | undefined)
      : undefined,
): Promise<GeolocationPermissionState> {
  if (!permissions?.query) return "unknown";
  try {
    const result = await permissions.query({ name: "geolocation" });
    if (result.state === "granted" || result.state === "prompt" || result.state === "denied") {
      return result.state;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * On Log a catch mount: start GPS only when the phone already allowed it.
 * Do not call getCurrentPosition while the permission is still a prompt —
 * iPhone will not show the dialog without a tap, and a no-gesture call can
 * swallow the later Allow location tap.
 */
export async function startLiveLocationOnLogOpen(args?: {
  geolocation?: DeviceGeolocation | null;
  permissions?: DevicePermissions | null;
}): Promise<PhotoGps | null> {
  const state = await queryGeolocationPermission(args?.permissions);
  if (state !== "granted") return null;
  return requestDeviceGps(args?.geolocation);
}

/**
 * Start GPS from the Allow location tap. Must not be awaited before
 * getCurrentPosition — iPhone needs that call in the same user gesture.
 * Camera must never call this.
 */
export function requestLiveLocationFromGesture(
  geolocation: DeviceGeolocation | null | undefined = typeof navigator !== "undefined"
    ? navigator.geolocation
    : undefined,
): Promise<PhotoGps | null> {
  return requestDeviceGps(geolocation);
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
