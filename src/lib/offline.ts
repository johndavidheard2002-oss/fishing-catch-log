import { countsForCatch } from "./count";
import { inferHabitat } from "./habitat";
import { JOURNAL_LOCKED, journalUnlocked, type EntitlementSnapshot } from "./entitlement";
import { primarySpecies } from "./species";
import { seasonFromDate, timeOfDayFromDate } from "./time";
import type { BaitSpot, CalendarNote, CatchInput, CatchRecord, Habitat, Season, TimeOfDay } from "./types";

/** Locked Tide Mark offline copy — do not rephrase. */
export const OFFLINE_LOG_SAVED =
  "Offline. This log is saved on this phone. It will upload when service returns.";
export const OFFLINE_LOCATION_FILL_LATER =
  "Location will fill when service returns. You can enter it by hand now.";
export const OFFLINE_CONDITIONS_FILL_LATER =
  "Weather, tides, and conditions will fill when service returns.";
export const WAITING_FOR_SERVICE_CHIP = "Waiting for service";
export const OFFLINE_MAP_TILES_NOTE =
  "Map tiles need a connection. Pin dropping on the map can wait. This phone’s GPS is saved.";
export const MANUAL_ENTRY_AFTER_RECONNECT =
  "Location or date-time still empty. Enter them by hand.";

export const PENDING_CATCH_PREFIX = "pending-";
export const OFFLINE_PHOTO_HOLD_ID = "hold";
export const OFFLINE_QUEUE_EVENT = "tide-mark-offline-queue";

export const OFFLINE_SHELL_PATHS = ["/", "/calendar", "/log", "/catch/view", "/spots", "/backfill"] as const;

export type QueuedLogStatus = "queued" | "syncing";

export type QueuedLog = {
  id: string;
  createdAt: string;
  payload: Record<string, unknown>;
  photoName: string | null;
  photoType: string | null;
  hasPhotoBlob: boolean;
  serverPhotoPath: string | null;
  status: QueuedLogStatus;
  needsConditions: boolean;
  viewerId: string;
};

export type JournalCache = {
  viewerId: string;
  catches: CatchRecord[];
  baitSpots: BaitSpot[];
  notes: CalendarNote[];
  cachedAt: string;
};

export type CachedSession = {
  signedIn: true;
  me: { id: string };
  entitlement: EntitlementSnapshot | null;
  cachedAt: string;
};

export function isPendingCatchId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(PENDING_CATCH_PREFIX));
}

export function newPendingCatchId(now = Date.now()): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${PENDING_CATCH_PREFIX}${rand}`;
}

export function isBrowserOnline(env: { onLine?: boolean } | null | undefined = defaultNavigator()): boolean {
  return env?.onLine !== false;
}

function defaultNavigator(): { onLine?: boolean } | null {
  return typeof navigator === "undefined" ? null : navigator;
}

export function isNetworkFailure(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof TypeError) return true;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (name === "NetworkError" || name === "AbortError") return true;
  return /failed to fetch|networkerror|load failed|offline|the internet connection appears to be offline/i.test(
    message,
  );
}

export function isJournalLockError(error: unknown, httpStatus?: number): boolean {
  if (httpStatus === 401 || httpStatus === 403) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes(JOURNAL_LOCKED) || /subscribe to keep your journal unlocked/i.test(message);
}

/** Queue a new log only when the journal is unlocked and the service is unreachable. */
export function shouldQueueOfflineSave(args: {
  locked?: boolean;
  online?: boolean;
  httpStatus?: number;
  error?: unknown;
}): boolean {
  if (args.locked) return false;
  if (isJournalLockError(args.error, args.httpStatus)) return false;
  if (args.online === false) return true;
  return isNetworkFailure(args.error);
}

export function cachedJournalUnlocked(entitlement: EntitlementSnapshot | null | undefined): boolean {
  if (!entitlement) return false;
  return journalUnlocked(entitlement.subscriptionStatus);
}

export function emptyApiConditions(payload: {
  temperatureF?: unknown;
  weatherCondition?: unknown;
  windSpeedMph?: unknown;
  tide?: unknown;
  tideDetail?: unknown;
}): boolean {
  return (
    payload.temperatureF == null &&
    !payload.weatherCondition &&
    payload.windSpeedMph == null &&
    !payload.tide &&
    !payload.tideDetail
  );
}

export function missingLocation(payload: { latitude?: unknown; longitude?: unknown }): boolean {
  return payload.latitude == null || payload.longitude == null;
}

export function missingCaughtAt(payload: { caughtAt?: unknown }): boolean {
  if (typeof payload.caughtAt !== "string" || !payload.caughtAt.trim()) return true;
  const at = new Date(payload.caughtAt);
  return Number.isNaN(at.getTime());
}

export function needsManualEntryAfterReconnect(payload: {
  latitude?: unknown;
  longitude?: unknown;
  caughtAt?: unknown;
}): boolean {
  return missingLocation(payload) || missingCaughtAt(payload);
}

export function offlineFormNotes(args: {
  online: boolean;
  hasLocation: boolean;
  mapTilesAvailable: boolean;
  hasApiConditions: boolean;
}): string[] {
  if (args.online) return [];
  const notes: string[] = [];
  if (!args.hasLocation) notes.push(OFFLINE_LOCATION_FILL_LATER);
  if (!args.hasApiConditions) notes.push(OFFLINE_CONDITIONS_FILL_LATER);
  if (!args.mapTilesAvailable) notes.push(OFFLINE_MAP_TILES_NOTE);
  return notes;
}

export function catchDetailHref(
  id: string,
  online: boolean = isBrowserOnline(),
): string {
  if (isPendingCatchId(id) || !online) {
    return `/catch/view?id=${encodeURIComponent(id)}`;
  }
  return `/catch/${id}`;
}

export function mergeJournalWithPending(
  cached: CatchRecord[],
  pending: CatchRecord[],
): CatchRecord[] {
  const pendingIds = new Set(pending.map((row) => row.id));
  return [...pending, ...cached.filter((row) => !pendingIds.has(row.id))];
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function queuedPayloadNeedsConditions(payload: Record<string, unknown>): boolean {
  return emptyApiConditions(payload);
}

export function pendingCatchRecord(args: {
  queued: QueuedLog;
  photoPath?: string | null;
  ownerName?: string;
}): CatchRecord {
  const payload = args.queued.payload;
  const speciesList = asStringArray(payload.speciesList);
  const species = asString(payload.species) || primarySpecies(speciesList) || "Unknown";
  const list = speciesList.length ? speciesList : [species];
  const caughtRaw = asString(payload.caughtAt) ?? args.queued.createdAt;
  const caught = new Date(caughtRaw);
  const caughtAt = Number.isNaN(caught.getTime()) ? new Date(args.queued.createdAt) : caught;
  const habitat = (asString(payload.habitat) as Habitat | null) ?? inferHabitat(species);
  const photoPath =
    args.photoPath ??
    asString(payload.photoPath) ??
    args.queued.serverPhotoPath ??
    null;
  const record: CatchRecord = {
    id: args.queued.id,
    photoPath,
    species,
    speciesList: list,
    speciesSuggested: asString(payload.speciesSuggested),
    speciesConfidence: asNumber(payload.speciesConfidence),
    speciesSource: "manual",
    latitude: asNumber(payload.latitude),
    longitude: asNumber(payload.longitude),
    photoTakenLatitude: asNumber(payload.photoTakenLatitude),
    photoTakenLongitude: asNumber(payload.photoTakenLongitude),
    placeName: asString(payload.placeName),
    temperatureF: asNumber(payload.temperatureF),
    weatherCondition: (asString(payload.weatherCondition) as CatchRecord["weatherCondition"]) ?? null,
    windSpeedMph: asNumber(payload.windSpeedMph),
    windDirection: asString(payload.windDirection),
    precipitationIn: asNumber(payload.precipitationIn),
    humidity: asNumber(payload.humidity),
    moonPhase: asString(payload.moonPhase),
    moonIllumination: asNumber(payload.moonIllumination),
    pressureInHg: asNumber(payload.pressureInHg),
    pressureMb: asNumber(payload.pressureMb),
    pressureTrend: asString(payload.pressureTrend),
    caughtAt: caughtAt.toISOString(),
    timeOfDay: (asString(payload.timeOfDay) as TimeOfDay | null) ?? timeOfDayFromDate(caughtAt),
    season: (asString(payload.season) as Season | null) ?? seasonFromDate(caughtAt),
    notes: asString(payload.notes),
    bait: asString(payload.bait),
    tide: asString(payload.tide),
    tideHeightFt: asNumber(payload.tideHeightFt),
    tideDetail: asString(payload.tideDetail),
    waterClarity: asString(payload.waterClarity),
    habitat,
    fishCount: asNumber(payload.fishCount) ?? 1,
    speciesCounts: [],
    anglerId: args.queued.viewerId || "you",
    sharedWithLinked: payload.sharedWithLinked === true,
    sharedWithBuddyIds: [],
    ownerName: args.ownerName ?? "You",
    createdAt: args.queued.createdAt,
    updatedAt: args.queued.createdAt,
  };
  record.speciesCounts = countsForCatch({ ...record, speciesCounts: [] });
  return record;
}

export function catchInputFromQueued(payload: Record<string, unknown>): CatchInput {
  return payload as CatchInput;
}

let offlineQueueVersion = 0;

export function getOfflineQueueVersion() {
  return offlineQueueVersion;
}

export function getOfflineQueueVersionServerSnapshot() {
  return 0;
}

export function notifyOfflineQueueChanged() {
  offlineQueueVersion += 1;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
}

export function subscribeOfflineQueue(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onChange = () => onStoreChange();
  window.addEventListener(OFFLINE_QUEUE_EVENT, onChange);
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener(OFFLINE_QUEUE_EVENT, onChange);
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function getOfflineOnlineSnapshot() {
  return isBrowserOnline();
}

export function getOfflineOnlineServerSnapshot() {
  return true;
}
