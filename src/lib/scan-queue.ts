/** In-memory queue of library photos left after opening one. Survives SPA navigation only. */

export type QueuedScanCandidate = {
  file: File;
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

export function setScanQueue(items: QueuedScanCandidate[]) {
  queue = items;
}

export function peekScanQueue(): QueuedScanCandidate[] {
  return queue;
}

export function scanQueueCount(): number {
  return queue.length;
}

/**
 * Copy leftover photos into the review list. Does not clear the module queue —
 * Strict Mode double-inits must still see the same File objects.
 */
export function hydrateScanQueue(): QueuedScanCandidate[] {
  return peekScanQueue();
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
