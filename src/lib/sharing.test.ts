import { describe, expect, it } from "vitest";
import { isCatchVisibleToViewer } from "./sharing";

describe("isCatchVisibleToViewer", () => {
  const you = "you";
  const buddy = "sam";

  it("always shows the viewer's own catches, even when unshared", () => {
    expect(
      isCatchVisibleToViewer({
        anglerId: you,
        sharedWithLinked: false,
        viewerId: you,
        includeShared: false,
        linkedBuddyIds: [buddy],
      }),
    ).toBe(true);
  });

  it("hides a buddy's catch unless they shared it and you opted into combined view", () => {
    const shared = {
      anglerId: buddy,
      sharedWithLinked: true,
      viewerId: you,
      includeShared: true,
      linkedBuddyIds: [buddy],
    };
    expect(isCatchVisibleToViewer(shared)).toBe(true);
    expect(isCatchVisibleToViewer({ ...shared, sharedWithLinked: false })).toBe(false);
    expect(isCatchVisibleToViewer({ ...shared, includeShared: false })).toBe(false);
    expect(isCatchVisibleToViewer({ ...shared, linkedBuddyIds: [] })).toBe(false);
  });

  it("never shows a stranger's catch", () => {
    expect(
      isCatchVisibleToViewer({
        anglerId: "stranger",
        sharedWithLinked: true,
        viewerId: you,
        includeShared: true,
        linkedBuddyIds: [buddy],
      }),
    ).toBe(false);
  });
});
