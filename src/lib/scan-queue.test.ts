import { describe, expect, it } from "vitest";
import {
  hydrateScanQueue,
  pathAfterScanCatchSave,
  peekScanQueue,
  reviewListFromScanResults,
  scanQueueCount,
  setScanQueue,
  sortScanReviewList,
} from "./scan-queue";

describe("scanQueue", () => {
  it("holds remaining library photos across SPA navigation", () => {
    setScanQueue([]);
    expect(scanQueueCount()).toBe(0);
    const file = new File(["x"], "catch.jpg", { type: "image/jpeg" });
    setScanQueue([
      {
        file,
        caughtAtIso: "2024-06-12T13:40:00.000Z",
        note: "",
        confidence: 0.7,
        demo: true,
        likely: false,
      },
    ]);
    expect(scanQueueCount()).toBe(1);
    expect(peekScanQueue()[0].file.name).toBe("catch.jpg");
    expect(peekScanQueue()[0].likely).toBe(false);
    setScanQueue([]);
  });

  it("does not drop the queue when hydration runs twice (Strict Mode)", () => {
    const file = new File(["x"], "trout.jpg", { type: "image/jpeg" });
    setScanQueue([
      {
        file,
        caughtAtIso: "2024-06-12T13:40:00.000Z",
        note: "",
        confidence: 0.5,
        demo: true,
        likely: true,
      },
    ]);
    const first = hydrateScanQueue();
    const second = hydrateScanQueue();
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(scanQueueCount()).toBe(1);
    expect(first[0].file).toBe(file);
    expect(second[0].file).toBe(file);
    expect(peekScanQueue()[0].file.name).toBe("trout.jpg");
    setScanQueue([]);
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
