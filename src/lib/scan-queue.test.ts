import { describe, expect, it } from "vitest";
import { peekScanQueue, scanQueueCount, setScanQueue } from "./scan-queue";

describe("scanQueue", () => {
  it("holds remaining library candidates across SPA navigation", () => {
    setScanQueue([]);
    expect(scanQueueCount()).toBe(0);
    const file = new File(["x"], "catch.jpg", { type: "image/jpeg" });
    setScanQueue([{ file, caughtAtIso: "2024-06-12T13:40:00.000Z", note: "", confidence: 0.7, demo: true }]);
    expect(scanQueueCount()).toBe(1);
    expect(peekScanQueue()[0].file.name).toBe("catch.jpg");
    setScanQueue([]);
  });
});
