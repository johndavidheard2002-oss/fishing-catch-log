/** Photo GPS is often the cooler, dock, or truck — not the water. */

export type PinSource = "photo" | "device" | "manual";

export type PhotoGps = { latitude: number; longitude: number };

export const DROP_CATCH_PIN_HINT = "Drop a pin on the map for where you caught it.";

/** Live Log GPS — started from Turn location on or Camera, in that tap. */
export const LIVE_GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 60_000,
};

/** First Allow tap — same user gesture. Short high-accuracy try, then a faster fallback. */
export const ALLOW_GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 6_000,
  maximumAge: 60_000,
};

/** After the first Allow try — phones that never lock a high-accuracy fix can still proceed. */
export const ALLOW_GPS_FALLBACK_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8_000,
  maximumAge: 120_000,
};

/** After permission is granted — no gesture needed. */
export const LIVE_GPS_FOLLOWUP_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 120_000,
};

export const LIVE_CAMERA_GPS_BUDGET_MS = 20_000;
/** Allow / Turn location on never wait forever. Camera keeps the longer 20s budget. */
export const ALLOW_GPS_BUDGET_MS = 12_000;
export const LIVE_GPS_RETRY_GAP_MS = 250;

export const LIVE_LOCATION_STORAGE_KEY = "cast-log-live-gps";

export type LiveLocationStatus = "prompt" | "asking" | "ready" | "unavailable" | "denied";

/** Persisted after the Allow location tap, even before GPS coords arrive. */
export type SavedLiveLocationStatus = "ready" | "allowed" | "unavailable" | "denied";

export type DeviceGpsFailure = "denied" | "timeout" | "unavailable" | "missing";

export type DeviceGpsAttempt =
  | { ok: true; gps: PhotoGps }
  | { ok: false; reason: DeviceGpsFailure };

export const LOCATION_OFF_PIN_HINT = "Location was off. Tap the map to pin this catch.";
export const TAP_MAP_PIN_HINT = "Tap the map to drop a pin.";
export const DROPPING_PIN_HINT = "Dropping pin from this phone…";
export const GETTING_LOCATION_LABEL = "Getting location…";
export const PINNED_FROM_PHONE_HINT = "Pinned from this phone";
export const LOCATION_DENIED_SETTINGS_HINT =
  "Location is blocked. Open iPhone Settings → Safari → Location → Allow for this site.";
export const ASKING_VISIBLE_MS = 400;

export const ALLOW_LOCATION_LABEL = "Allow location";
export const SKIP_LOCATION_LABEL = "Not now";
export const CONTINUE_WITHOUT_LOCATION_LABEL = "Continue without location";
export const TURN_LOCATION_ON_LABEL = "Turn location on";

export function skipLocationLabel(): string {
  return SKIP_LOCATION_LABEL;
}

export function shouldShowTurnLocationOn(status: LiveLocationStatus): boolean {
  return status !== "ready";
}

export function logLocationReason(
  status: LiveLocationStatus,
  osDenied = false,
): string {
  if (status === "ready") {
    return PINNED_FROM_PHONE_HINT;
  }
  if (status === "asking") {
    return GETTING_LOCATION_LABEL;
  }
  if (osDenied || status === "denied") {
    return LOCATION_DENIED_SETTINGS_HINT;
  }
  return "Allow location so a live photo can drop the pin on the water.";
}

/** One Log location surface — never stack Turn location on + off banners. */
export function logLocationSurface(args: {
  status: LiveLocationStatus;
  hasPin: boolean;
  photoAtCatch: boolean | null;
  osDenied?: boolean;
}): {
  showTurnOn: boolean;
  reason: string | null;
  pinHint: string | null;
  emptyMapBanner: string | null;
} {
  if (args.status === "asking") {
    return {
      showTurnOn: true,
      reason: GETTING_LOCATION_LABEL,
      pinHint: null,
      emptyMapBanner: null,
    };
  }
  if (args.status === "ready") {
    return {
      showTurnOn: false,
      reason: args.hasPin ? PINNED_FROM_PHONE_HINT : null,
      pinHint: null,
      emptyMapBanner: null,
    };
  }
  if (args.osDenied || args.status === "denied") {
    return {
      showTurnOn: true,
      reason: LOCATION_DENIED_SETTINGS_HINT,
      pinHint: null,
      emptyMapBanner: null,
    };
  }
  if (args.photoAtCatch === false && !args.hasPin) {
    return {
      showTurnOn: false,
      reason: null,
      pinHint: null,
      emptyMapBanner: DROP_CATCH_PIN_HINT,
    };
  }
  return {
    showTurnOn: true,
    reason: logLocationReason(args.status),
    pinHint: null,
    emptyMapBanner: null,
  };
}

export function visibleCatchPinHint(args: {
  pinHint: string | null;
  liveLog: boolean;
  locationStatus: LiveLocationStatus;
}): string | null {
  if (!args.pinHint) return null;
  if (args.pinHint === DROPPING_PIN_HINT) return args.pinHint;
  if (!args.liveLog) return args.pinHint;
  if (args.locationStatus !== "ready") return null;
  if (args.pinHint === LOCATION_OFF_PIN_HINT || args.pinHint === TAP_MAP_PIN_HINT) return null;
  return args.pinHint;
}

/** Camera: start GPS in this tap unless location is already ready or blocked. */
export function liveCameraTapAction(
  status: LiveLocationStatus | undefined,
): "start-gps" | "open-camera" | "wait" {
  if (status == null || status === "ready" || status === "denied") return "open-camera";
  if (status === "asking") return "wait";
  return "start-gps";
}

/** After Turn location on: pin now if a photo is on the form and the pin is empty. */
export function pinFromTurnedOnLocation(args: {
  hasPhoto: boolean;
  pinEmpty: boolean;
  userMovedCatchPin: boolean;
  gps: PhotoGps;
}): { latitude: number; longitude: number; source: "device" } | null {
  if (!args.hasPhoto || !args.pinEmpty || args.userMovedCatchPin) return null;
  return { ...args.gps, source: "device" };
}

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
    let settled = false;
    const finish = (result: DeviceGpsAttempt) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timeoutMs = options.timeout ?? ALLOW_GPS_BUDGET_MS;
    const timer = setTimeout(() => finish({ ok: false, reason: "timeout" }), timeoutMs);
    geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        finish({
          ok: true,
          gps: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        });
      },
      (err) => {
        clearTimeout(timer);
        finish({ ok: false, reason: classifyGpsError(err) });
      },
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

function remainingBudgetMs(started: number, budgetMs: number | null): number | null {
  if (budgetMs == null) return null;
  return budgetMs - (Date.now() - started);
}

/** Hard-cap a hanging getCurrentPosition so Allow / Camera never await forever. */
function raceGpsAttempt(
  attempt: Promise<DeviceGpsAttempt>,
  waitMs: number,
  signal?: AbortSignal,
): Promise<DeviceGpsAttempt> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: DeviceGpsAttempt) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    if (signal?.aborted) {
      finish({ ok: false, reason: "unavailable" });
      return;
    }
    const timer = setTimeout(() => finish({ ok: false, reason: "timeout" }), Math.max(waitMs, 1));
    const onAbort = () => {
      clearTimeout(timer);
      finish({ ok: false, reason: "unavailable" });
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    void attempt.then((result) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      finish(result);
    });
  });
}

/**
 * Keep requesting a fix after Allow or a live Camera photo.
 * Denied / missing geolocation stops immediately. Timeouts retry until
 * budgetMs elapses. Allow defaults to ~12s so Getting location… cannot hang.
 * getCurrentPosition is also raced against the remaining budget — some phones
 * never succeed and never return denied when enableHighAccuracy stays on.
 */
export async function waitForLiveLocationFix(args?: {
  firstAttempt?: Promise<DeviceGpsAttempt>;
  firstOptions?: PositionOptions;
  geolocation?: DeviceGeolocation | null;
  options?: PositionOptions;
  budgetMs?: number | null;
  retryGapMs?: number;
  signal?: AbortSignal;
}): Promise<DeviceGpsAttempt> {
  const geo = args?.geolocation === undefined ? defaultGeolocation() : args.geolocation;
  const options = args?.options ?? LIVE_GPS_FOLLOWUP_OPTIONS;
  const budgetMs = args?.budgetMs === undefined ? ALLOW_GPS_BUDGET_MS : args.budgetMs;
  const retryGapMs = args?.retryGapMs ?? LIVE_GPS_RETRY_GAP_MS;
  const started = Date.now();

  const capFor = (attemptTimeout: number) => {
    const remaining = remainingBudgetMs(started, budgetMs);
    if (remaining == null) return attemptTimeout;
    return Math.min(attemptTimeout, Math.max(remaining, 1));
  };

  const awaitAttempt = (attempt: Promise<DeviceGpsAttempt>, attemptTimeout: number) =>
    raceGpsAttempt(attempt, capFor(attemptTimeout), args?.signal);

  let attempt =
    args?.firstAttempt ??
    (args?.signal?.aborted
      ? Promise.resolve<DeviceGpsAttempt>({ ok: false, reason: "unavailable" })
      : requestDeviceGpsAttempt(geo, options));
  let attemptTimeout =
    args?.firstAttempt != null
      ? (args.firstOptions?.timeout ?? options.timeout ?? 10_000)
      : (options.timeout ?? 10_000);

  while (true) {
    if (args?.signal?.aborted) return { ok: false, reason: "unavailable" };
    const remaining = remainingBudgetMs(started, budgetMs);
    if (remaining != null && remaining <= 0) return { ok: false, reason: "timeout" };
    const result = await awaitAttempt(attempt, attemptTimeout);
    if (result.ok) return result;
    if (result.reason === "denied" || result.reason === "missing") return result;
    if (args?.signal?.aborted) return { ok: false, reason: "unavailable" };
    const afterAttempt = remainingBudgetMs(started, budgetMs);
    if (afterAttempt != null && afterAttempt <= 0) return result;
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
    const leftover = remainingBudgetMs(started, budgetMs);
    if (leftover != null && leftover <= 0) return result;
    attemptTimeout = options.timeout ?? 10_000;
    attempt = requestDeviceGpsAttempt(geo, {
      ...options,
      timeout: leftover == null ? attemptTimeout : Math.min(attemptTimeout, Math.max(leftover, 1)),
    });
  }
}

/**
 * Allow-tap wait: short high-accuracy first try, then low-accuracy retries,
 * hard-capped so the sign-in screen cannot sit on Getting location… forever.
 */
export function waitForAllowLocationFix(args?: {
  firstAttempt?: Promise<DeviceGpsAttempt>;
  geolocation?: DeviceGeolocation | null;
  budgetMs?: number;
  retryGapMs?: number;
  signal?: AbortSignal;
}): Promise<DeviceGpsAttempt> {
  return waitForLiveLocationFix({
    firstAttempt: args?.firstAttempt,
    firstOptions: ALLOW_GPS_OPTIONS,
    geolocation: args?.geolocation,
    options: ALLOW_GPS_FALLBACK_OPTIONS,
    budgetMs: args?.budgetMs ?? ALLOW_GPS_BUDGET_MS,
    retryGapMs: args?.retryGapMs,
    signal: args?.signal,
  });
}

/**
 * After Allow (or timeout): enter the journal. Timeout / no-fix keeps
 * "allowed" so Camera can still try later. OS deny is denied, not Not now.
 */
export function persistAllowLocationOutcome(
  result: DeviceGpsAttempt | { skip: true },
  storage?: Storage | null,
): { savedStatus: SavedLiveLocationStatus; enterJournal: true } {
  if ("skip" in result) {
    writeSavedLiveLocation(null, storage);
    return { savedStatus: "unavailable", enterJournal: true };
  }
  if (result.ok) {
    writeSavedLiveLocation(result.gps, storage);
    return { savedStatus: "ready", enterJournal: true };
  }
  if (result.reason === "denied") {
    writeSavedLiveLocationDenied(storage);
    return { savedStatus: "denied", enterJournal: true };
  }
  if (result.reason === "missing") {
    writeSavedLiveLocation(null, storage);
    return { savedStatus: "unavailable", enterJournal: true };
  }
  writeSavedLiveLocationAllowed(storage);
  return { savedStatus: "allowed", enterJournal: true };
}

/**
 * Log / Camera tap after a timeout or Not now. Timeout stays allowed.
 * OS deny is unavailable + Settings copy — never a silent return.
 */
export function persistLogLocationOutcome(
  result: DeviceGpsAttempt,
  storage?: Storage | null,
): { savedStatus: SavedLiveLocationStatus; uiStatus: LiveLocationStatus; osDenied: boolean } {
  if (result.ok) {
    writeSavedLiveLocation(result.gps, storage);
    return { savedStatus: "ready", uiStatus: "ready", osDenied: false };
  }
  if (result.reason === "denied") {
    writeSavedLiveLocationDenied(storage);
    return { savedStatus: "denied", uiStatus: "unavailable", osDenied: true };
  }
  if (result.reason === "missing") {
    writeSavedLiveLocation(null, storage);
    return { savedStatus: "unavailable", uiStatus: "unavailable", osDenied: false };
  }
  writeSavedLiveLocationAllowed(storage);
  return { savedStatus: "allowed", uiStatus: "prompt", osDenied: false };
}

/** Keep Getting location… on screen long enough that a <50ms deny is visible. */
export function holdAskingVisible<T>(
  work: Promise<T>,
  minMs: number = ASKING_VISIBLE_MS,
): Promise<T> {
  const started = Date.now();
  return work.then(async (result) => {
    const wait = minMs - (Date.now() - started);
    if (wait > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, wait);
      });
    }
    return result;
  });
}

/**
 * Click path for Turn location on. getCurrentPosition is the first
 * synchronous call — iOS drops the prompt if storage or setState runs first.
 */
export function handleTurnLocationOnClick(
  geolocation: DeviceGeolocation | null | undefined = defaultGeolocation(),
  options?: { minAskingMs?: number },
): { attempt: Promise<DeviceGpsAttempt>; uiStatus: "asking" } {
  const first = requestDeviceGpsAttempt(geolocation, ALLOW_GPS_OPTIONS);
  try {
    writeSavedLiveLocationAllowed();
  } catch {
    /* quota / private mode must not swallow the tap */
  }
  const raw = waitForAllowLocationFix({ firstAttempt: first, geolocation });
  return {
    attempt: holdAskingVisible(raw, options?.minAskingMs ?? ASKING_VISIBLE_MS),
    uiStatus: "asking",
  };
}

/**
 * Start GPS from Turn location on / Camera. getCurrentPosition runs first in
 * this call stack — iOS drops the prompt if anything async happens first.
 * Storage writes never block that call.
 */
export function startLogLocationFromGesture(
  geolocation: DeviceGeolocation | null | undefined = defaultGeolocation(),
): Promise<DeviceGpsAttempt> {
  return handleTurnLocationOnClick(geolocation, { minAskingMs: 0 }).attempt;
}

/**
 * Button / Camera tap entry. getCurrentPosition is invoked before this
 * function returns. UI must flip to asking in the same turn.
 */
export function beginLogLocationFromButtonTap(
  geolocation: DeviceGeolocation | null | undefined = defaultGeolocation(),
  options?: { minAskingMs?: number },
): { attempt: Promise<DeviceGpsAttempt>; uiStatus: "asking" } {
  try {
    return handleTurnLocationOnClick(geolocation, options);
  } catch {
    return {
      attempt: Promise.resolve({ ok: false, reason: "unavailable" }),
      uiStatus: "asking",
    };
  }
}

/** Allow-without-coords is not ready — Log shows Turn location on, not a hang. */
export function initialLiveLocationStatusFromSaved(
  saved: SavedLiveLocationStatus | null,
): LiveLocationStatus {
  if (saved === "ready") return "ready";
  if (saved === "allowed") return "prompt";
  if (saved === "unavailable") return "unavailable";
  if (saved === "denied") return "denied";
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
  if (status === "denied") {
    return {
      title: "Location blocked",
      body: LOCATION_DENIED_SETTINGS_HINT,
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
      body: "This phone is finding where you are. Not now is always available if this takes too long — Camera can still try later.",
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
  | { status: "denied" }
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
    if (parsed.status === "denied") return { status: "denied" };
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
  | { status: "denied" }
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
    try {
      store.setItem(LIVE_LOCATION_STORAGE_KEY, value);
    } catch {
      /* quota / private mode */
    }
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

/** OS denied location — Settings, not a casual Not now. */
export function writeSavedLiveLocationDenied(storage?: Storage | null): void {
  writeLiveLocationRecord(JSON.stringify({ status: "denied" }), storage);
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
  firstAttempt?: Promise<DeviceGpsAttempt>;
}): Promise<PhotoGps | null> {
  if (args.savedGps) return args.savedGps;
  if (args.firstAttempt) {
    const result = await waitForLiveLocationFix({
      firstAttempt: args.firstAttempt,
      firstOptions: ALLOW_GPS_OPTIONS,
      geolocation: args.geolocation,
      options: ALLOW_GPS_FALLBACK_OPTIONS,
      budgetMs: args.budgetMs ?? LIVE_CAMERA_GPS_BUDGET_MS,
      retryGapMs: args.retryGapMs,
    });
    return result.ok ? result.gps : null;
  }
  const permission = await queryGeolocationPermission(args.permissions);
  if (!liveLocationWasAllowed(args.savedStatus, permission)) return null;
  const result = await waitForLiveLocationFix({
    geolocation: args.geolocation,
    budgetMs: args.budgetMs ?? LIVE_CAMERA_GPS_BUDGET_MS,
    retryGapMs: args.retryGapMs,
    options: ALLOW_GPS_FALLBACK_OPTIONS,
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
  firstAttempt?: Promise<DeviceGpsAttempt>;
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
    firstAttempt: args.firstAttempt,
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
 * After Yes: photo EXIF GPS first (source photo). If Safari stripped GPS,
 * use this phone’s location (source device) — including Backfill / past mode.
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
  if (args.deviceGps) {
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
