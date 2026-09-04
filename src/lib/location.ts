/** Photo GPS is often the cooler, dock, or truck — not the water. */

export type PinSource = "photo" | "device" | "manual";

export type PhotoGps = { latitude: number; longitude: number };

export const DROP_CATCH_PIN_HINT = "Drop a pin on the map for where you caught it.";

/** Live Log GPS — asked after sign-in, never inside the Camera tap. */
export const LIVE_GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 60_000,
};

/** First Allow tap — same user gesture. Longer than LIVE_GPS_OPTIONS so iPhone can lock. */
export const ALLOW_GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 60_000,
};

/** After permission is granted — no gesture needed. */
export const LIVE_GPS_FOLLOWUP_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 120_000,
};

export const LIVE_CAMERA_GPS_BUDGET_MS = 20_000;
export const LIVE_GPS_RETRY_GAP_MS = 250;

export const LIVE_LOCATION_STORAGE_KEY = "cast-log-live-gps";

export type LiveLocationStatus = "prompt" | "asking" | "ready" | "unavailable";

/** Persisted after the Allow location tap, even before GPS coords arrive. */
export type SavedLiveLocationStatus = "ready" | "allowed" | "unavailable";

export type DeviceGpsFailure = "denied" | "timeout" | "unavailable" | "missing";

export type DeviceGpsAttempt =
  | { ok: true; gps: PhotoGps }
  | { ok: false; reason: DeviceGpsFailure };

export const LOCATION_OFF_PIN_HINT = "Location was off. Tap the map to pin this catch.";
export const DROPPING_PIN_HINT = "Dropping pin from this phone…";
export const GETTING_LOCATION_LABEL = "Getting location…";

export const ALLOW_LOCATION_LABEL = "Allow location";
export const SKIP_LOCATION_LABEL = "Not now";

export type DeviceGeolocation = {
  getCurrentPosition: (
    success: (position: { coords: { latitude: number; longitude: number } }) => void,
    error?: (err?: { code?: number }) => void,
    options?: PositionOptions,
  ) => void;
};

export type DevicePermissions = {
  query: (desc: { name: string }) => Promise<{ state: string }>;
};

export type GeolocationPermissionState = "granted" | "prompt" | "denied" | "unknown";

function defaultGeolocation(): DeviceGeolocation | null | undefined {
  return typeof navigator !== "undefined" ? navigator.geolocation : undefined;
}

export function classifyGpsError(err?: { code?: number } | null): DeviceGpsFailure {
  if (err?.code === 1) return "denied";
  if (err?.code === 3) return "timeout";
  return "unavailable";
}

export function requestDeviceGpsAttempt(
  geolocation: DeviceGeolocation | null | undefined = defaultGeolocation(),
  options: PositionOptions = LIVE_GPS_OPTIONS,
): Promise<DeviceGpsAttempt> {
  if (!geolocation) return Promise.resolve({ ok: false, reason: "missing" });
  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          gps: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        }),
      (err) => resolve({ ok: false, reason: classifyGpsError(err) }),
      options,
    );
  });
}

/**
 * One-shot GPS. Errors, timeouts, and missing geolocation all resolve null
 * so live Log can still open the camera and let them drop a pin by hand.
 */
export function requestDeviceGps(
  geolocation: DeviceGeolocation | null | undefined = defaultGeolocation(),
  options: PositionOptions = LIVE_GPS_OPTIONS,
): Promise<PhotoGps | null> {
  return requestDeviceGpsAttempt(geolocation, options).then((result) =>
    result.ok ? result.gps : null,
  );
}

/**
 * Keep requesting a fix after Allow or a live Camera photo.
 * Denied / missing geolocation stops immediately. Timeouts retry until
 * budgetMs elapses (camera) or forever (Allow — they can still tap Not now).
 */
export async function waitForLiveLocationFix(args?: {
  firstAttempt?: Promise<DeviceGpsAttempt>;
  geolocation?: DeviceGeolocation | null;
  options?: PositionOptions;
  budgetMs?: number | null;
  retryGapMs?: number;
  signal?: AbortSignal;
}): Promise<DeviceGpsAttempt> {
  const geo = args?.geolocation === undefined ? defaultGeolocation() : args.geolocation;
  const options = args?.options ?? LIVE_GPS_FOLLOWUP_OPTIONS;
  const budgetMs = args?.budgetMs;
  const retryGapMs = args?.retryGapMs ?? LIVE_GPS_RETRY_GAP_MS;
  const started = Date.now();

  let attempt =
    args?.firstAttempt ??
    (args?.signal?.aborted
      ? Promise.resolve<DeviceGpsAttempt>({ ok: false, reason: "unavailable" })
      : requestDeviceGpsAttempt(geo, options));

  while (true) {
    if (args?.signal?.aborted) return { ok: false, reason: "unavailable" };
    const result = await attempt;
    if (result.ok) return result;
    if (result.reason === "denied" || result.reason === "missing") return result;
    if (args?.signal?.aborted) return { ok: false, reason: "unavailable" };
    if (budgetMs != null && Date.now() - started >= budgetMs) return result;
    if (retryGapMs > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, retryGapMs);
        const onAbort = () => {
          clearTimeout(timer);
          resolve();
        };
        args?.signal?.addEventListener("abort", onAbort, { once: true });
      });
    }
    if (args?.signal?.aborted) return { ok: false, reason: "unavailable" };
    if (budgetMs != null && Date.now() - started >= budgetMs) return result;
    const remaining =
      budgetMs == null ? (options.timeout ?? 10_000) : budgetMs - (Date.now() - started);
    if (budgetMs != null && remaining <= 0) return result;
    attempt = requestDeviceGpsAttempt(geo, {
      ...options,
      timeout: Math.min(options.timeout ?? 10_000, Math.max(remaining, 1)),
    });
  }
}

/** Allow is not ready until lat/lng are stored. "allowed" keeps showing Getting location… */
export function initialLiveLocationStatusFromSaved(
  saved: SavedLiveLocationStatus | null,
): LiveLocationStatus {
  if (saved === "ready") return "ready";
  if (saved === "allowed") return "asking";
  if (saved === "unavailable") return "unavailable";
  return "prompt";
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
      title: GETTING_LOCATION_LABEL,
      body: "This phone is finding where you are. A live photo can drop the pin once we have it.",
    };
  }
  return {
    title: "Allow location",
    body: "Allow location so a live photo can drop the pin on the water where you caught the fish. You can still move the pin.",
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
 * Refresh GPS only when location was already allowed (no iPhone dialog).
 * iPhone often cannot report "granted" — a saved Allow from sign-in is enough.
 * Do not call this to ask for permission — that tap belongs on sign-in.
 */
export async function refreshLiveLocationIfGranted(args?: {
  geolocation?: DeviceGeolocation | null;
  permissions?: DevicePermissions | null;
  savedStatus?: SavedLiveLocationStatus | null;
}): Promise<PhotoGps | null> {
  const state = await queryGeolocationPermission(args?.permissions);
  if (state === "denied") return null;
  const saved = args?.savedStatus ?? readSavedLiveLocationStatus();
  if (state !== "granted" && saved !== "ready" && saved !== "allowed") return null;
  return requestDeviceGps(args?.geolocation);
}

function liveLocationStores(): Storage[] {
  const stores: Storage[] = [];
  try {
    if (typeof localStorage !== "undefined") stores.push(localStorage);
  } catch {
    /* private mode */
  }
  try {
    if (typeof sessionStorage !== "undefined") stores.push(sessionStorage);
  } catch {
    /* private mode */
  }
  return stores;
}

export function readSavedLiveLocation(
  storage?: Storage | null,
): PhotoGps | null {
  const parsed = readSavedLiveLocationRecord(storage);
  if (parsed?.status !== "ready") return null;
  return { latitude: parsed.latitude, longitude: parsed.longitude };
}

export function readSavedLiveLocationStatus(
  storage?: Storage | null,
): SavedLiveLocationStatus | null {
  return readSavedLiveLocationRecord(storage)?.status ?? null;
}

function parseLiveLocationRecord(
  storage: Storage,
):
  | { status: "ready"; latitude: number; longitude: number }
  | { status: "allowed" }
  | { status: "unavailable" }
  | null {
  try {
    const raw = storage.getItem(LIVE_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      status?: string;
      latitude?: number;
      longitude?: number;
    };
    if (parsed.status === "unavailable") return { status: "unavailable" };
    if (parsed.status === "allowed") return { status: "allowed" };
    if (
      parsed.status === "ready" &&
      typeof parsed.latitude === "number" &&
      typeof parsed.longitude === "number" &&
      Number.isFinite(parsed.latitude) &&
      Number.isFinite(parsed.longitude)
    ) {
      return { status: "ready", latitude: parsed.latitude, longitude: parsed.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

function readSavedLiveLocationRecord(
  storage?: Storage | null,
):
  | { status: "ready"; latitude: number; longitude: number }
  | { status: "allowed" }
  | { status: "unavailable" }
  | null {
  if (storage === null) return null;
  if (storage) return parseLiveLocationRecord(storage);
  for (const store of liveLocationStores()) {
    const parsed = parseLiveLocationRecord(store);
    if (parsed) return parsed;
  }
  return null;
}

function writeLiveLocationRecord(
  value: string,
  storage?: Storage | null,
): void {
  if (storage === null) return;
  const targets = storage ? [storage] : liveLocationStores();
  for (const store of targets) {
    store.setItem(LIVE_LOCATION_STORAGE_KEY, value);
  }
}

/** Persist the sign-in GPS so later Camera taps can pin without asking again. */
export function writeSavedLiveLocation(
  gps: PhotoGps | null,
  storage?: Storage | null,
): void {
  if (gps) {
    writeLiveLocationRecord(
      JSON.stringify({ status: "ready", latitude: gps.latitude, longitude: gps.longitude }),
      storage,
    );
    return;
  }
  writeLiveLocationRecord(JSON.stringify({ status: "unavailable" }), storage);
}

/**
 * They tapped Allow. Persist that grant so Camera can keep requesting GPS.
 * Do not treat this as ready — ready requires stored lat/lng.
 */
export function writeSavedLiveLocationAllowed(storage?: Storage | null): void {
  if (readSavedLiveLocation(storage)) return;
  writeLiveLocationRecord(JSON.stringify({ status: "allowed" }), storage);
}

export function clearSavedLiveLocation(storage?: Storage | null): void {
  if (storage === null) return;
  const targets = storage ? [storage] : liveLocationStores();
  for (const store of targets) {
    store.removeItem(LIVE_LOCATION_STORAGE_KEY);
  }
}

export function liveLocationWasAllowed(
  savedStatus: SavedLiveLocationStatus | null | undefined,
  permission: GeolocationPermissionState = "unknown",
): boolean {
  if (savedStatus === "ready" || savedStatus === "allowed") return true;
  return permission === "granted";
}

/**
 * Live Camera: saved ready coords pin immediately. If they Allowed but the
 * first reading has not arrived, keep requesting GPS until a fix or ~20s.
 * Skipped / denied location with no saved pin returns null so the existing
 * tap-the-map banner can still show.
 */
export async function resolveLiveCameraDeviceGps(args: {
  savedGps: PhotoGps | null;
  savedStatus: SavedLiveLocationStatus | null;
  geolocation?: DeviceGeolocation | null;
  permissions?: DevicePermissions | null;
  budgetMs?: number;
  retryGapMs?: number;
}): Promise<PhotoGps | null> {
  if (args.savedGps) return args.savedGps;
  const permission = await queryGeolocationPermission(args.permissions);
  if (!liveLocationWasAllowed(args.savedStatus, permission)) return null;
  const result = await waitForLiveLocationFix({
    geolocation: args.geolocation,
    budgetMs: args.budgetMs ?? LIVE_CAMERA_GPS_BUDGET_MS,
    retryGapMs: args.retryGapMs,
    options: LIVE_GPS_FOLLOWUP_OPTIONS,
  });
  return result.ok ? result.gps : null;
}

/** After a live Camera file: pin from saved ready coords or a post-photo GPS fix. */
export async function resolveLiveCameraPinAfterPhoto(args: {
  userMovedCatchPin: boolean;
  savedGps: PhotoGps | null;
  savedStatus: SavedLiveLocationStatus | null;
  geolocation?: DeviceGeolocation | null;
  permissions?: DevicePermissions | null;
  budgetMs?: number;
  retryGapMs?: number;
}): Promise<{
  pin: { latitude: number; longitude: number; source: "device" } | null;
  deviceGps: PhotoGps | null;
}> {
  const deviceGps = await resolveLiveCameraDeviceGps({
    savedGps: args.savedGps,
    savedStatus: args.savedStatus,
    geolocation: args.geolocation,
    permissions: args.permissions,
    budgetMs: args.budgetMs,
    retryGapMs: args.retryGapMs,
  });
  return {
    deviceGps,
    pin: resolveLiveCameraCatchPin({
      userMovedCatchPin: args.userMovedCatchPin,
      deviceGps,
    }),
  };
}

/**
 * Start GPS from the Allow location tap. Must not be awaited before
 * getCurrentPosition — iPhone needs that call in the same user gesture.
 * Camera must never call this.
 */
export function requestLiveLocationFromGesture(
  geolocation: DeviceGeolocation | null | undefined = defaultGeolocation(),
): Promise<PhotoGps | null> {
  return requestDeviceGps(geolocation, ALLOW_GPS_OPTIONS);
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
