import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  forgetScanQueueMemory,
  hydrateScanQueue,
  pathAfterScanCatchSave,
  peekScanQueue,
  removeScanQueueByPhotoPath,
  reviewListFromScanResults,
  SCAN_QUEUE_STORAGE_KEY,
  scanQueueCount,
  setScanQueue,
  sortScanReviewList,
  type QueuedScanCandidate,
} from "./scan-queue";

function mockSessionStorage() {
  const store = new Map<string, string>();
  const memory: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: memory,
  });
}

function sample(path: string, extras: Partial<QueuedScanCandidate> = {}): QueuedScanCandidate {
  return {
    photoPath: path,
    caughtAtIso: "2024-06-12T13:40:00.000Z",
    note: "",
    confidence: 0.7,
    demo: true,
    likely: false,
    ...extras,
  };
}

beforeEach(() => {
  mockSessionStorage();
  forgetScanQueueMemory();
  setScanQueue([]);
});

afterEach(() => {
  setScanQueue([]);
  forgetScanQueueMemory();
});

describe("scanQueue", () => {
  it("persists leftovers so a memory wipe still hydrates them", () => {
    setScanQueue([sample("catch.jpg", { likely: false })]);
    expect(scanQueueCount()).toBe(1);
    expect(peekScanQueue()[0].photoPath).toBe("catch.jpg");
    expect(sessionStorage.getItem(SCAN_QUEUE_STORAGE_KEY)).toContain("catch.jpg");

    forgetScanQueueMemory();
    expect(scanQueueCount()).toBe(1);
    const restored = hydrateScanQueue();
    expect(restored).toHaveLength(1);
    expect(restored[0].photoPath).toBe("catch.jpg");
    expect(restored[0].likely).toBe(false);
  });

  it("does not drop the queue when hydration runs twice (Strict Mode)", () => {
    setScanQueue([sample("trout.jpg", { confidence: 0.5, likely: true })]);
    const first = hydrateScanQueue();
    const second = hydrateScanQueue();
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(scanQueueCount()).toBe(1);
    expect(first[0].photoPath).toBe("trout.jpg");
    expect(second[0].photoPath).toBe("trout.jpg");
  });

  it("clears persistence when a new batch empties the list", () => {
    setScanQueue([sample("a.jpg"), sample("b.jpg")]);
    setScanQueue([]);
    forgetScanQueueMemory();
    expect(hydrateScanQueue()).toEqual([]);
    expect(scanQueueCount()).toBe(0);
  });

  it("removes a saved photoPath from the leftover queue", () => {
    setScanQueue([sample("keep.jpg"), sample("saved.jpg")]);
    removeScanQueueByPhotoPath("saved.jpg");
    expect(peekScanQueue().map((item) => item.photoPath)).toEqual(["keep.jpg"]);
    forgetScanQueueMemory();
    expect(hydrateScanQueue().map((item) => item.photoPath)).toEqual(["keep.jpg"]);
  });
});

describe("pathAfterScanCatchSave", () => {
  it("returns to the scan list when photos remain", () => {
    expect(
      pathAfterScanCatchSave({
        remainingCount: 3,
        afterSave: "calendar",
        catchId: "c1",
        dayKey: "2024-06-12",
      }),
    ).toBe("/log/scan");
    expect(
      pathAfterScanCatchSave({
        remainingCount: 1,
        afterSave: "detail",
        catchId: "c1",
        dayKey: "2024-06-12",
      }),
    ).toBe("/log/scan");
  });

  it("keeps calendar or detail when the queue is empty", () => {
    expect(
      pathAfterScanCatchSave({
        remainingCount: 0,
        afterSave: "calendar",
        catchId: "c1",
        dayKey: "2024-06-12",
      }),
    ).toBe("/calendar?day=2024-06-12");
    expect(
      pathAfterScanCatchSave({
        remainingCount: 0,
        afterSave: "detail",
        catchId: "c1",
        dayKey: "2024-06-12",
      }),
    ).toBe("/catch/c1");
  });
});

describe("reviewListFromScanResults", () => {
  it("keeps every opened photo even when detection says unlikely", () => {
    const list = reviewListFromScanResults([
      { opened: true, likely: false, confidence: 0.82, name: "screenshot.jpg" },
      { opened: true, likely: true, confidence: 0.46, name: "IMG_1042.jpg" },
      { opened: false, likely: true, confidence: 0.9, name: "broken.heic" },
    ]);
    expect(list.map((r) => r.name)).toEqual(["IMG_1042.jpg", "screenshot.jpg"]);
    expect(list).toHaveLength(2);
  });

  it("sorts likely fish first without dropping any opened photo", () => {
    const sorted = sortScanReviewList([
      { id: "a", likely: false, confidence: 0.9 },
      { id: "b", likely: true, confidence: 0.4 },
      { id: "c", likely: true, confidence: 0.8 },
      { id: "d", likely: false, confidence: 0.2 },
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["c", "b", "a", "d"]);
    expect(sorted).toHaveLength(4);
  });
});
