/** In-memory queue of library candidates left after “Yes, add”. Survives SPA navigation only. */

export type QueuedScanCandidate = {
  file: File;
  caughtAtIso: string;
  note: string;
  confidence: number;
  demo: boolean;
  photoTakenLatitude?: number | null;
  photoTakenLongitude?: number | null;
};

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
