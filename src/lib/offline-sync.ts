import { JOURNAL_LOCKED, journalUnlocked, type EntitlementSnapshot } from "./entitlement";
import {
  OFFLINE_PHOTO_HOLD_ID,
  cachedJournalUnlocked,
  emptyApiConditions,
  isNetworkFailure,
  needsManualEntryAfterReconnect,
  newPendingCatchId,
  notifyOfflineQueueChanged,
  pendingCatchRecord,
  queuedPayloadNeedsConditions,
  shouldQueueOfflineSave,
  type CachedSession,
  type QueuedLog,
} from "./offline";
import {
  getQueuedLog,
  getQueuedPhoto,
  listQueuedLogs,
  markManualEntryCatch,
  readCachedSession,
  removeQueuedLog,
  saveQueuedLog,
  saveQueuedPhoto,
} from "./offline-store";

export type EnqueueOfflineLogArgs = {
  payload: Record<string, unknown>;
  photo?: Blob | File | null;
  viewerId?: string;
  now?: string;
  id?: string;
};

export type SyncQueuedResult = {
  queuedId: string;
  catchId?: string;
  error?: string;
  skippedLocked?: boolean;
};

type FetchLike = typeof fetch;

function defaultViewerId(explicit?: string) {
  return explicit?.trim() || "you";
}

export async function holdOfflinePhoto(photo: Blob | File) {
  const name = "name" in photo && photo.name ? photo.name : "catch.jpg";
  const type = photo.type || "image/jpeg";
  await saveQueuedPhoto(OFFLINE_PHOTO_HOLD_ID, photo);
  await saveQueuedLog({
    id: OFFLINE_PHOTO_HOLD_ID,
    createdAt: new Date().toISOString(),
    payload: { photoName: name, photoType: type },
    photoName: name,
    photoType: type,
    hasPhotoBlob: true,
    serverPhotoPath: null,
    status: "queued",
    needsConditions: false,
    viewerId: "",
  });
}

export async function readHeldOfflinePhoto(): Promise<Blob | null> {
  return getQueuedPhoto(OFFLINE_PHOTO_HOLD_ID);
}

export async function clearHeldOfflinePhoto() {
  await removeQueuedLog(OFFLINE_PHOTO_HOLD_ID);
}

export async function enqueueOfflineLog(args: EnqueueOfflineLogArgs): Promise<QueuedLog> {
  const id = args.id ?? newPendingCatchId();
  const createdAt = args.now ?? new Date().toISOString();
  const photo = args.photo ?? null;
  const photoName =
    photo && "name" in photo && typeof photo.name === "string" && photo.name
      ? photo.name
      : photo
        ? "catch.jpg"
        : null;
  const photoType: string | null = photo ? photo.type || "image/jpeg" : null;
  if (photo) await saveQueuedPhoto(id, photo);
  const queued: QueuedLog = {
    id,
    createdAt,
    payload: { ...args.payload },
    photoName,
    photoType,
    hasPhotoBlob: Boolean(photo),
    serverPhotoPath: typeof args.payload.photoPath === "string" ? args.payload.photoPath : null,
    status: "queued",
    needsConditions: queuedPayloadNeedsConditions(args.payload),
    viewerId: defaultViewerId(args.viewerId),
  };
  await saveQueuedLog(queued);
  if (id !== OFFLINE_PHOTO_HOLD_ID) await removeQueuedLog(OFFLINE_PHOTO_HOLD_ID).catch(() => {});
  return queued;
}

export async function updateQueuedLog(
  id: string,
  args: { payload: Record<string, unknown>; photo?: Blob | File | null },
): Promise<QueuedLog | null> {
  const current = await getQueuedLog(id);
  if (!current) return null;
  if (args.photo) {
    await saveQueuedPhoto(id, args.photo);
    current.hasPhotoBlob = true;
    current.photoName = "name" in args.photo && args.photo.name ? args.photo.name : current.photoName;
    current.photoType = args.photo.type || current.photoType;
  }
  current.payload = { ...args.payload };
  current.needsConditions = queuedPayloadNeedsConditions(args.payload);
  current.status = "queued";
  await saveQueuedLog(current);
  return current;
}

async function uploadPhoto(
  queued: QueuedLog,
  fetchImpl: FetchLike,
): Promise<{ photoPath: string | null; error?: string; network?: boolean }> {
  if (queued.serverPhotoPath) return { photoPath: queued.serverPhotoPath };
  const existing = typeof queued.payload.photoPath === "string" ? queued.payload.photoPath : null;
  if (existing) return { photoPath: existing };
  if (!queued.hasPhotoBlob) return { photoPath: null };
  const blob = await getQueuedPhoto(queued.id);
  if (!blob) return { photoPath: null };
  const file = new File([blob], queued.photoName || "catch.jpg", {
    type: queued.photoType || blob.type || "image/jpeg",
  });
  const fd = new FormData();
  fd.set("photo", file);
  try {
    const up = await fetchImpl("/api/media", { method: "POST", body: fd });
    const data = (await up.json().catch(() => ({}))) as { photoPath?: string; error?: string; locked?: boolean };
    if (up.status === 401 || up.status === 403 || data.locked) {
      return { photoPath: null, error: data.error || JOURNAL_LOCKED };
    }
    if (!up.ok || !data.photoPath) {
      return { photoPath: null, error: data.error || "Photo upload failed" };
    }
    return { photoPath: data.photoPath };
  } catch (error) {
    return { photoPath: null, error: error instanceof Error ? error.message : "Photo upload failed", network: true };
  }
}

async function fillConditions(
  payload: Record<string, unknown>,
  fetchImpl: FetchLike,
): Promise<Record<string, unknown>> {
  if (!emptyApiConditions(payload)) return payload;
  const latitude = typeof payload.latitude === "number" ? payload.latitude : Number(payload.latitude);
  const longitude = typeof payload.longitude === "number" ? payload.longitude : Number(payload.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return payload;
  const at = typeof payload.caughtAt === "string" ? payload.caughtAt : undefined;
  try {
    const res = await fetchImpl("/api/assist/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude,
        longitude,
        at,
        habitat: payload.habitat,
      }),
    });
    if (!res.ok) return payload;
    const data = (await res.json()) as {
      weather?: Record<string, unknown> | null;
      tide?: Record<string, unknown> | null;
    };
    const weather = data.weather ?? {};
    const tide = data.tide ?? {};
    return {
      ...payload,
      temperatureF: payload.temperatureF ?? weather.temperatureF ?? null,
      weatherCondition: payload.weatherCondition ?? weather.weatherCondition ?? null,
      windSpeedMph: payload.windSpeedMph ?? weather.windSpeedMph ?? null,
      windDirection: payload.windDirection ?? weather.windDirection ?? null,
      precipitationIn: payload.precipitationIn ?? weather.precipitationIn ?? null,
      humidity: payload.humidity ?? weather.humidity ?? null,
      moonPhase: payload.moonPhase ?? weather.moonPhase ?? null,
      moonIllumination: payload.moonIllumination ?? weather.moonIllumination ?? null,
      pressureInHg: payload.pressureInHg ?? weather.pressureInHg ?? null,
      pressureMb: payload.pressureMb ?? weather.pressureMb ?? null,
      pressureTrend: payload.pressureTrend ?? weather.pressureTrend ?? null,
      tide: payload.tide ?? tide.tide ?? null,
      tideHeightFt: payload.tideHeightFt ?? tide.heightFt ?? tide.tideHeightFt ?? null,
      tideDetail: payload.tideDetail ?? tide.detail ?? tide.tideDetail ?? null,
    };
  } catch {
    return payload;
  }
}

async function postCatch(
  payload: Record<string, unknown>,
  fetchImpl: FetchLike,
): Promise<{ catchId?: string; record?: { id: string }; error?: string; locked?: boolean; network?: boolean }> {
  try {
    const res = await fetchImpl("/api/catches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      catch?: { id: string };
      error?: string;
      locked?: boolean;
    };
    if (res.status === 401 || res.status === 403 || data.locked) {
      return { error: data.error || JOURNAL_LOCKED, locked: true };
    }
    if (!res.ok || !data.catch?.id) {
      return { error: data.error || "Could not save" };
    }
    return { catchId: data.catch.id, record: data.catch };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save",
      network: true,
    };
  }
}

async function patchCatch(
  id: string,
  payload: Record<string, unknown>,
  fetchImpl: FetchLike,
) {
  try {
    await fetchImpl(`/api/catches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* conditions are optional after the catch itself is saved */
  }
}

export async function syncQueuedLog(
  id: string,
  args: { fetch?: FetchLike; locked?: boolean } = {},
): Promise<SyncQueuedResult> {
  const fetchImpl = args.fetch ?? fetch;
  const queued = await getQueuedLog(id);
  if (!queued || queued.id === OFFLINE_PHOTO_HOLD_ID) {
    return { queuedId: id, error: "Missing queued log" };
  }
  if (args.locked) return { queuedId: id, skippedLocked: true };

  queued.status = "syncing";
  await saveQueuedLog(queued);

  const photo = await uploadPhoto(queued, fetchImpl);
  if (photo.error) {
    queued.status = "queued";
    await saveQueuedLog(queued);
    if (photo.network || photo.error === JOURNAL_LOCKED) {
      return { queuedId: id, error: photo.error, skippedLocked: photo.error === JOURNAL_LOCKED };
    }
    return { queuedId: id, error: photo.error };
  }

  const payload = { ...queued.payload, photoPath: photo.photoPath };
  queued.serverPhotoPath = photo.photoPath;
  queued.payload = payload;
  await saveQueuedLog(queued);

  const saved = await postCatch(payload, fetchImpl);
  if (saved.locked) {
    queued.status = "queued";
    await saveQueuedLog(queued);
    return { queuedId: id, error: saved.error, skippedLocked: true };
  }
  if (saved.error) {
    queued.status = "queued";
    await saveQueuedLog(queued);
    return { queuedId: id, error: saved.error };
  }

  if (queued.needsConditions && saved.catchId) {
    const filled = await fillConditions(payload, fetchImpl);
    if (!emptyApiConditions(filled)) {
      await patchCatch(saved.catchId, filled, fetchImpl);
    }
  }

  if (saved.catchId && needsManualEntryAfterReconnect(queued.payload)) {
    await markManualEntryCatch(saved.catchId);
  }

  await removeQueuedLog(id);
  notifyOfflineQueueChanged();
  return { queuedId: id, catchId: saved.catchId };
}

export async function syncQueuedLogs(args: { fetch?: FetchLike; locked?: boolean } = {}): Promise<{
  synced: number;
  failed: number;
  skippedLocked: number;
  results: SyncQueuedResult[];
}> {
  const locked = args.locked ?? false;
  const items = (await listQueuedLogs()).filter((item) => item.id !== OFFLINE_PHOTO_HOLD_ID);
  const results: SyncQueuedResult[] = [];
  for (const item of items) {
    results.push(await syncQueuedLog(item.id, { fetch: args.fetch, locked }));
  }
  return {
    synced: results.filter((row) => row.catchId).length,
    failed: results.filter((row) => row.error && !row.skippedLocked).length,
    skippedLocked: results.filter((row) => row.skippedLocked).length,
    results,
  };
}

export async function queuedCatchRecords(args: { ownerName?: string } = {}) {
  const items = (await listQueuedLogs()).filter((item) => item.id !== OFFLINE_PHOTO_HOLD_ID);
  const records = [];
  for (const queued of items) {
    const blob = queued.hasPhotoBlob ? await getQueuedPhoto(queued.id) : null;
    const photoPath = blob ? URL.createObjectURL(blob) : queued.serverPhotoPath;
    records.push(pendingCatchRecord({ queued, photoPath, ownerName: args.ownerName }));
  }
  return records;
}

export async function readQueuedCatchRecord(id: string, args: { ownerName?: string } = {}) {
  const queued = await getQueuedLog(id);
  if (!queued || queued.id === OFFLINE_PHOTO_HOLD_ID) return null;
  const blob = queued.hasPhotoBlob ? await getQueuedPhoto(id) : null;
  const photoPath = blob ? URL.createObjectURL(blob) : queued.serverPhotoPath;
  return pendingCatchRecord({ queued, photoPath, ownerName: args.ownerName });
}

export function canSyncNow(args: {
  online?: boolean;
  entitlement?: EntitlementSnapshot | null;
  cached?: CachedSession | null;
}): boolean {
  if (args.online === false) return false;
  const entitlement = args.entitlement ?? args.cached?.entitlement ?? null;
  if (entitlement && !journalUnlocked(entitlement.subscriptionStatus)) return false;
  if (!entitlement && args.cached && !cachedJournalUnlocked(args.cached.entitlement)) return false;
  return true;
}

export async function syncQueuedLogsIfOnline(args: {
  fetch?: FetchLike;
  online?: boolean;
  entitlement?: EntitlementSnapshot | null;
} = {}) {
  const cached = args.entitlement ? null : await readCachedSession();
  if (!canSyncNow({ online: args.online, entitlement: args.entitlement, cached })) {
    return { synced: 0, failed: 0, skippedLocked: 0, results: [] as SyncQueuedResult[] };
  }
  const locked = args.entitlement
    ? !journalUnlocked(args.entitlement.subscriptionStatus)
    : Boolean(cached?.entitlement && !journalUnlocked(cached.entitlement.subscriptionStatus));
  return syncQueuedLogs({ fetch: args.fetch, locked });
}

export function shouldHoldPhotoOffline(args: { online?: boolean; error?: unknown }) {
  return args.online === false || isNetworkFailure(args.error);
}

export { shouldQueueOfflineSave };
