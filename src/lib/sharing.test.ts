import { describe, expect, it } from "vitest";
import { baitOf, catchOf } from "./testing";
import { dayShareSpots, isCatchVisibleToViewer, sharePlaceName } from "./sharing";

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
