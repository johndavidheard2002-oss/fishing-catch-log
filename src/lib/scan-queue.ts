/** Durable queue of Find fish photos leftovers. Survives refresh via sessionStorage. */

export const SCAN_QUEUE_STORAGE_KEY = "cast-log-scan-queue";

export type QueuedScanCandidate = {
  photoPath: string;
  caughtAtIso: string;
  note: string;
  confidence: number;
  demo: boolean;
  likely?: boolean;
  photoTakenLatitude?: number | null;
  photoTakenLongitude?: number | null;
};

export type ScanReviewSortKey = {
  likely: boolean;
  confidence: number;
};

/** Likely-fish first, then higher confidence. Never drops a photo. */
export function sortScanReviewList<T extends ScanReviewSortKey>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.likely !== b.likely) return a.likely ? -1 : 1;
    return b.confidence - a.confidence;
  });
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
  return (
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
  queue = items;
  persist(items);
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
