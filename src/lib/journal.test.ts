import { describe, expect, it } from "vitest";
import { mergeJournalFeed } from "./journal";
import { baitOf, catchOf } from "./testing";

describe("mergeJournalFeed", () => {
  it("merges catches and bait newest first", () => {
    const catchRow = catchOf({ id: "c1", caughtAt: "2026-08-02T10:00:00.000Z" });
    const baitRow = baitOf({ id: "b1", loggedAt: "2026-08-02T14:00:00.000Z" });
    const older = catchOf({ id: "c0", caughtAt: "2026-08-01T12:00:00.000Z" });
    const feed = mergeJournalFeed([catchRow, older], [baitRow]);
    expect(feed.map((item) => item.id)).toEqual(["bait:b1", "catch:c1", "catch:c0"]);
  });

  it("returns bait-only when there are no catches", () => {
    const baitRow = baitOf({
      id: "shared-bait",
      anglerId: "buddy",
      ownerName: "Pat",
      sharedWithLinked: true,
    });
    const feed = mergeJournalFeed([], [baitRow]);
    expect(feed).toHaveLength(1);
    expect(feed[0].kind).toBe("bait");
    if (feed[0].kind === "bait") expect(feed[0].spot.ownerName).toBe("Pat");
  });
});
