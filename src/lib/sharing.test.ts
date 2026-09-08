import { describe, expect, it } from "vitest";
import { baitOf, catchOf } from "./testing";
import {
  dayShareSpots,
  isCatchVisibleToViewer,
  OWNER_PRIVATE_STATUS_LINE,
  ownerShareBadgeLabel,
  ownerShareFriendNames,
  ownerShareStatusLine,
  ownerSharedDays,
  recordedSharePlaceName,
  resolveShareTargets,
  sharePlaceName,
} from "./sharing";
import { PRIVACY_LINE } from "./privacy";

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

  it("shows a spot only to the friend it was shared with", () => {
    const samOnly = {
      anglerId: you,
      sharedWithLinked: false,
      viewerId: buddy,
      includeShared: true,
      linkedBuddyIds: [you],
      sharedWithBuddyIds: [buddy],
    };
    expect(isCatchVisibleToViewer(samOnly)).toBe(true);
    expect(isCatchVisibleToViewer({ ...samOnly, viewerId: "pat", linkedBuddyIds: [you] })).toBe(
      false,
    );
    expect(isCatchVisibleToViewer({ ...samOnly, sharedWithBuddyIds: ["pat"] })).toBe(false);
    expect(
      resolveShareTargets({ shared: true, buddyIds: [buddy], linkedBuddyIds: [buddy, "pat"] }),
    ).toEqual({ sharedWithLinked: false, buddyIds: [buddy] });
    expect(resolveShareTargets({ shared: true, linkedBuddyIds: [buddy] })).toEqual({
      sharedWithLinked: true,
      buddyIds: [],
    });
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

describe("ownerShareBadgeLabel", () => {
  const friends = [
    { id: "tyler", name: "Tyler" },
    { id: "mo", name: "Mo" },
  ];

  it("says Private when the owner has not shared with anyone", () => {
    expect(
      ownerShareBadgeLabel({
        sharedWithLinked: false,
        sharedWithBuddyIds: [],
        friends,
      }),
    ).toBe("Private");
  });

  it("names the friends on a selective share, not Private", () => {
    expect(
      ownerShareBadgeLabel({
        sharedWithLinked: false,
        sharedWithBuddyIds: ["tyler"],
        friends,
      }),
    ).toBe("Shared · Tyler");
    expect(
      ownerShareFriendNames({
        sharedWithLinked: false,
        sharedWithBuddyIds: ["tyler", "mo"],
        friends,
      }),
    ).toEqual(["Tyler", "Mo"]);
    expect(
      ownerShareBadgeLabel({
        sharedWithLinked: false,
        sharedWithBuddyIds: ["tyler", "mo"],
        friends,
      }),
    ).toBe("Shared · Tyler, Mo");
  });

  it("lists every linked friend when the spot is shared with all", () => {
    expect(
      ownerShareBadgeLabel({
        sharedWithLinked: true,
        sharedWithBuddyIds: [],
        friends,
      }),
    ).toBe("Shared · Tyler, Mo");
  });

  it("says Shared without names when friends have not loaded yet", () => {
    expect(
      ownerShareBadgeLabel({
        sharedWithLinked: false,
        sharedWithBuddyIds: ["tyler"],
        friends: [],
      }),
    ).toBe("Shared");
  });
});

describe("ownerShareStatusLine", () => {
  const friends = [
    { id: "tyler", name: "Tyler Tamburin" },
    { id: "mo", name: "Mo" },
  ];

  it("keeps the private line when the owner has not shared", () => {
    expect(
      ownerShareStatusLine({
        sharedWithLinked: false,
        sharedWithBuddyIds: [],
        friends,
      }),
    ).toBe(OWNER_PRIVATE_STATUS_LINE);
    expect(OWNER_PRIVATE_STATUS_LINE).toBe("Private to you. Not shared with anyone.");
  });

  it("names a selective share instead of saying Private", () => {
    expect(
      ownerShareStatusLine({
        sharedWithLinked: false,
        sharedWithBuddyIds: ["mo"],
        friends,
      }),
    ).toBe("Shared with Mo. Never public. No feed.");
    expect(
      ownerShareStatusLine({
        sharedWithLinked: false,
        sharedWithBuddyIds: ["tyler", "mo"],
        friends,
      }),
    ).toBe("Shared with Tyler Tamburin and Mo. Never public. No feed.");
  });

  it("does not invent Unnamed when a buddy id has no linked name", () => {
    expect(
      ownerShareStatusLine({
        sharedWithLinked: false,
        sharedWithBuddyIds: ["ghost"],
        friends,
      }),
    ).toBe("Shared. Never public. No feed.");
    expect(
      ownerShareStatusLine({
        sharedWithLinked: false,
        sharedWithBuddyIds: ["mo"],
        friends: [],
      }),
    ).toBe("Shared. Never public. No feed.");
    expect(
      ownerShareStatusLine({
        sharedWithLinked: false,
        sharedWithBuddyIds: ["mo"],
        friends,
      }),
    ).not.toMatch(/Unnamed/i);
  });

  it("keeps the linked-friends line when shared with all and names are not loaded", () => {
    expect(
      ownerShareStatusLine({
        sharedWithLinked: true,
        sharedWithBuddyIds: [],
        friends: [],
      }),
    ).toBe(`${PRIVACY_LINE} Never public. No feed.`);
    expect(
      ownerShareStatusLine({
        sharedWithLinked: true,
        sharedWithBuddyIds: [],
        friends,
      }),
    ).toBe("Shared with Tyler Tamburin and Mo. Never public. No feed.");
  });
});

describe("dayShareSpots", () => {
  it("groups the viewer’s same-pin catches into one share row", () => {
    const rows = dayShareSpots({
      viewerId: "you",
      baitSpots: [],
      catches: [
        catchOf({
          id: "a",
          species: "Redfish",
          placeName: "Haulover",
          latitude: 28.74,
          longitude: -80.75,
          sharedWithLinked: true,
        }),
        catchOf({
          id: "b",
          species: "Snook",
          placeName: "Haulover",
          latitude: 28.741,
          longitude: -80.751,
          sharedWithLinked: true,
        }),
        catchOf({
          id: "other",
          anglerId: "sam",
          species: "Tarpon",
          placeName: "Haulover",
          latitude: 28.74,
          longitude: -80.75,
        }),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("catch");
    expect(rows[0].placeName).toBe("Haulover");
    expect(rows[0].catchIds.sort()).toEqual(["a", "b"]);
    expect(rows[0].shared).toBe(true);
    expect(rows[0].summary.toLowerCase()).toContain("redfish");
  });

  it("keeps two pins as two spots so share only flips one group", () => {
    const rows = dayShareSpots({
      viewerId: "you",
      baitSpots: [],
      catches: [
        catchOf({
          id: "lagoon",
          species: "Redfish",
          placeName: "Lagoon",
          latitude: 28.74,
          longitude: -80.75,
        }),
        catchOf({
          id: "inlet",
          species: "Snook",
          placeName: "Inlet",
          latitude: 27.2,
          longitude: -80.2,
        }),
      ],
    });
    expect(rows).toHaveLength(2);
    const lagoon = rows.find((r) => r.placeName === "Lagoon");
    const inlet = rows.find((r) => r.placeName === "Inlet");
    expect(lagoon?.catchIds).toEqual(["lagoon"]);
    expect(inlet?.catchIds).toEqual(["inlet"]);
    expect(lagoon?.catchIds).not.toEqual(inlet?.catchIds);
  });

  it("lists viewer bait holes separately", () => {
    const rows = dayShareSpots({
      viewerId: "you",
      catches: [],
      baitSpots: [
        baitOf({ id: "bait-1", placeName: "Canal", baitTypes: ["Shrimp"] }),
        baitOf({ id: "buddy-bait", anglerId: "sam", placeName: "Canal", baitTypes: ["Mullet"] }),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("bait");
    expect(rows[0].baitSpotIds).toEqual(["bait-1"]);
    expect(rows[0].placeName).toBe("Canal");
    expect(rows[0].summary).toContain("Shrimp");
  });
});

describe("sharePlaceName", () => {
  it("uses the place name, then pinned, then unnamed", () => {
    expect(sharePlaceName({ placeName: "Haulover Canal", latitude: 28.7, longitude: -80.7 })).toBe(
      "Haulover Canal",
    );
    expect(sharePlaceName({ placeName: "28.740, -80.750", latitude: 28.74, longitude: -80.75 })).toBe(
      "Pinned spot",
    );
    expect(sharePlaceName({ placeName: null })).toBe("Unnamed spot");
  });
});

describe("recordedSharePlaceName", () => {
  it("keeps the stored name and skips blanks instead of inventing a label", () => {
    expect(recordedSharePlaceName("Haulover Canal")).toBe("Haulover Canal");
    expect(recordedSharePlaceName("  bait:Innertube cut  ")).toBe("Innertube cut");
    expect(recordedSharePlaceName("   ")).toBeNull();
    expect(recordedSharePlaceName(null)).toBeNull();
  });
});

describe("ownerSharedDays", () => {
  it("pairs each shared day with the spot names on those records", () => {
    const rows = ownerSharedDays({
      ownerId: "you",
      catches: [
        catchOf({
          id: "haulover",
          caughtAt: "2026-09-06T14:00:00.000Z",
          placeName: "Haulover Canal",
          sharedWithLinked: true,
        }),
        catchOf({
          id: "private",
          caughtAt: "2026-09-05T14:00:00.000Z",
          placeName: "Private hole",
          sharedWithLinked: false,
        }),
      ],
      baitSpots: [
        baitOf({
          id: "canal-bait",
          loggedAt: "2026-09-04T14:00:00.000Z",
          placeName: "Canal",
          sharedWithLinked: true,
        }),
      ],
    });
    expect(rows).toEqual([
      { day: "2026-09-06", placeNames: ["Haulover Canal"] },
      { day: "2026-09-04", placeNames: ["Canal"] },
    ]);
  });

  it("lists several spots on one day and still rows a day with no place name", () => {
    const rows = ownerSharedDays({
      ownerId: "you",
      catches: [
        catchOf({
          id: "lagoon",
          caughtAt: "2026-09-06T14:00:00.000Z",
          placeName: "Lagoon",
          sharedWithLinked: true,
        }),
        catchOf({
          id: "lagoon-again",
          caughtAt: "2026-09-06T16:00:00.000Z",
          placeName: "  lagoon  ",
          sharedWithBuddyIds: ["sam"],
        }),
        catchOf({
          id: "inlet",
          caughtAt: "2026-09-06T18:00:00.000Z",
          placeName: "Inlet",
          sharedWithBuddyIds: ["pat"],
        }),
        catchOf({
          id: "no-name",
          caughtAt: "2026-09-03T14:00:00.000Z",
          placeName: null,
          sharedWithLinked: true,
        }),
      ],
      baitSpots: [],
    });
    expect(rows).toEqual([
      { day: "2026-09-06", placeNames: ["Lagoon", "Inlet"] },
      { day: "2026-09-03", placeNames: [] },
    ]);
  });

  it("ignores a friend’s shared spots on the owner Home list", () => {
    const rows = ownerSharedDays({
      ownerId: "you",
      catches: [
        catchOf({
          id: "theirs",
          anglerId: "sam",
          caughtAt: "2026-09-06T14:00:00.000Z",
          placeName: "Friend hole",
          sharedWithLinked: true,
        }),
      ],
      baitSpots: [
        baitOf({
          id: "their-bait",
          anglerId: "sam",
          loggedAt: "2026-09-06T15:00:00.000Z",
          placeName: "Friend bait",
          sharedWithLinked: true,
        }),
      ],
    });
    expect(rows).toEqual([]);
  });
});
