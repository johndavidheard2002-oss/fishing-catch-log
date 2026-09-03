/** Durable queue of Find fish photos leftovers. Survives refresh via sessionStorage. */

export const SCAN_QUEUE_STORAGE_KEY = "cast-log-scan-queue";

/** `picked` = the angler chose these files. `scan` = detect-fish ranked a folder dump. */
export type ScanBatchOrigin = "picked" | "scan";

export type QueuedScanCandidate = {
  photoPath: string;
  caughtAtIso: string;
  note: string;
  confidence: number;
  demo: boolean;
  likely?: boolean;
  origin?: ScanBatchOrigin;
  photoTakenLatitude?: number | null;
  photoTakenLongitude?: number | null;
};

export type ScanReviewSortKey = {
  likely: boolean;
  confidence: number;
};

/** Missing or false stays unlikely — do not coerce undefined to likely. */
export function isLikelyScanPhoto(likely: boolean | undefined): boolean {
  return likely === true;
}

/** Likely-fish first, then higher confidence. Never drops a photo. */
export function sortScanReviewList<T extends { likely?: boolean; confidence: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aLikely = isLikelyScanPhoto(a.likely);
    const bLikely = isLikelyScanPhoto(b.likely);
    if (aLikely !== bLikely) return aLikely ? -1 : 1;
    return b.confidence - a.confidence;
  });
}

export function partitionScanReview<T extends { likely?: boolean }>(items: T[]): {
  likely: T[];
  unlikely: T[];
} {
  const likely: T[] = [];
  const unlikely: T[] = [];
  for (const item of items) {
    if (isLikelyScanPhoto(item.likely)) likely.push(item);
    else unlikely.push(item);
  }
  return { likely, unlikely };
}

export function normalizeScanOrigin(origin: ScanBatchOrigin | undefined): ScanBatchOrigin {
  return origin === "picked" ? "picked" : "scan";
}

/** A batch the angler chose by hand — every opened photo is an intended catch. */
export function isUserPickedScanBatch(items: { origin?: ScanBatchOrigin }[]): boolean {
  return items.length > 0 && items.every((item) => normalizeScanOrigin(item.origin) === "picked");
}

/** User-chosen photos are never ranked or labeled unlikely. */
export function asPickedScanItems<T extends { likely?: boolean; origin?: ScanBatchOrigin }>(
  items: T[],
): Array<T & { likely: true; origin: "picked" }> {
  return items.map((item) => ({ ...item, likely: true as const, origin: "picked" as const }));
}

/**
 * Review sections for the current queue.
 * Picked batches stay flat — detection must not invent an Unlikely group.
 * Folder-scan batches still split likely vs unlikely.
 */
export function presentScanReview<T extends { likely?: boolean; origin?: ScanBatchOrigin }>(
  items: T[],
): { origin: ScanBatchOrigin; likely: T[]; unlikely: T[] } {
  if (isUserPickedScanBatch(items)) {
    return { origin: "picked", likely: items, unlikely: [] };
  }
  return { origin: "scan", ...partitionScanReview(items) };
}

/**
 * Review list = every photo that opened. Detection only ranks; it never omits.
 * Failed opens (compress/read) stay out — those are `skipped`.
 */
export function reviewListFromScanResults<T extends ScanReviewSortKey & { opened: boolean }>(
  results: T[],
): T[] {
  return sortScanReviewList(results.filter((r) => r.opened));
}

let queue: QueuedScanCandidate[] = [];
let loaded = false;

function sessionStore(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function isStoredCandidate(value: unknown): value is QueuedScanCandidate {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const originOk = item.origin === undefined || item.origin === "picked" || item.origin === "scan";
  return (
    originOk &&
    typeof item.photoPath === "string" &&
    item.photoPath.trim().length > 0 &&
    typeof item.caughtAtIso === "string" &&
    typeof item.note === "string" &&
    typeof item.confidence === "number" &&
    typeof item.demo === "boolean"
  );
}

function loadPersisted(): QueuedScanCandidate[] {
  const store = sessionStore();
  if (!store) return [];
  try {
    const raw = store.getItem(SCAN_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(isStoredCandidate);
  } catch {
    return [];
  }
}

function persist(items: QueuedScanCandidate[]) {
  const store = sessionStore();
  if (!store) return;
  try {
    store.setItem(SCAN_QUEUE_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* private mode / quota — module memory still works for this tab */
  }
}

function ensureLoaded() {
  if (loaded) return;
  queue = loadPersisted();
  loaded = true;
}

/** Test helper: wipe module memory the way a full reload does. sessionStorage stays. */
export function forgetScanQueueMemory() {
  queue = [];
  loaded = false;
}

const SCAN_QUEUE_CHANGE_EVENT = "cast-log-scan-queue";
const EMPTY_QUEUE: QueuedScanCandidate[] = [];

function notifyScanQueueListeners() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SCAN_QUEUE_CHANGE_EVENT));
}

export function subscribeScanQueue(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onChange = () => onStoreChange();
  window.addEventListener(SCAN_QUEUE_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SCAN_QUEUE_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getScanQueueServerSnapshot(): QueuedScanCandidate[] {
  return EMPTY_QUEUE;
}

export function getScanQueueCountServerSnapshot() {
  return 0;
}

export function setScanQueue(items: QueuedScanCandidate[]) {
  loaded = true;
  queue = items.map((item) => {
    const origin = normalizeScanOrigin(item.origin);
    return {
      ...item,
      origin,
      likely: origin === "picked" ? true : isLikelyScanPhoto(item.likely),
    };
  });
  persist(queue);
  notifyScanQueueListeners();
}

export function peekScanQueue(): QueuedScanCandidate[] {
  ensureLoaded();
  return queue;
}

export function scanQueueCount(): number {
  return peekScanQueue().length;
}

/**
 * Reload leftovers from sessionStorage. Safe to call twice (Strict Mode).
 * Does not clear the persisted queue.
 */
export function hydrateScanQueue(): QueuedScanCandidate[] {
  queue = loadPersisted();
  loaded = true;
  return queue;
}

export function removeScanQueueByPhotoPath(photoPath: string) {
  const path = photoPath.trim();
  if (!path) return;
  setScanQueue(peekScanQueue().filter((item) => item.photoPath !== path));
}

/** After logging one scan photo, remaining items go back to the review list. */
export function pathAfterScanCatchSave(args: {
  remainingCount: number;
  afterSave: "calendar" | "detail";
  catchId: string;
  dayKey: string;
}): string {
  if (args.remainingCount > 0) return "/log/scan";
  if (args.afterSave === "calendar") return `/calendar?day=${args.dayKey}`;
  return `/catch/${args.catchId}`;
}
