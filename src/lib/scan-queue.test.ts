import { describe, expect, it } from "vitest";
import {
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
