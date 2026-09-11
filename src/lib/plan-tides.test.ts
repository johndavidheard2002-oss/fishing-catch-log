import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { catchOf, baitOf } from "./testing";
import {
  applyCatchTideSnapshot,
  catchTideLookupKey,
  fallbackChipFromDayTides,
  pinForPlannedSpot,
  planDayReferenceAt,
  plannedDayTideDetail,
  plannedSpotSameTide,
  plannedSpotTideRefreshKey,
  sameTideChipsForSpots,
} from "./plan-tides";
import { uniqueNotesByPlace } from "./plan";
import type { TideSnapshot } from "./tides/snapshot";

const extremes = [
  { at: "2026-10-10T05:46:00.000Z", type: "low" as const, heightFt: 0.5 },
  { at: "2026-10-10T12:09:00.000Z", type: "high" as const, heightFt: 4.7 },
  { at: "2026-10-10T18:46:00.000Z", type: "low" as const, heightFt: 0.6 },
];

const snap: TideSnapshot = {
  applies: true,
  tide: "outgoing",
  heightFt: 4.5,
  nextHighAt: "2026-10-10T12:09:00.000Z",
  nextHighFt: 4.7,
  nextLowAt: "2026-10-10T05:46:00.000Z",
  nextLowFt: 0.5,
  source: "noaa",
  note: "",
  extremes,
};

describe("planDayReferenceAt", () => {
  it("copies a catch clock onto the planned day", () => {
    const at = planDayReferenceAt("2026-10-10", "2026-09-01T14:00:00.000Z");
    expect(at?.toISOString()).toBe("2026-10-10T14:00:00.000Z");
    expect(planDayReferenceAt("2026-10-11", null)?.toISOString()).toBe("2026-10-11T16:00:00.000Z");
    expect(planDayReferenceAt("nope")).toBeNull();
  });
});

describe("pinForPlannedSpot", () => {
  it("uses the source catch pin, then a same-place journal catch", () => {
    const redfish = catchOf({
      id: "c-red",
      placeName: "Beach marker 42",
      habitat: "saltwater-inshore",
      latitude: 28.41,
      longitude: -80.63,
      caughtAt: "2026-09-01T14:00:00.000Z",
    });
    expect(pinForPlannedSpot({ sourceCatchId: "c-red" }, { catches: [redfish] })).toEqual({
      latitude: 28.41,
      longitude: -80.63,
      habitat: "saltwater-inshore",
      caughtAt: "2026-09-01T14:00:00.000Z",
      tideHeightFt: null,
      tide: null,
    });
    expect(pinForPlannedSpot({ placeName: "Beach marker 42" }, { catches: [redfish] })?.latitude).toBe(
      28.41,
    );
    expect(
      pinForPlannedSpot(
        { sourceBaitId: "b1" },
        { baitSpots: [baitOf({ id: "b1", loggedAt: "2026-08-02T14:00:00.000Z" })] },
      )?.caughtAt,
    ).toBe("2026-08-02T14:00:00.000Z");
    const withGps = catchOf({
      id: "c-gps",
      placeName: "Beach marker 42",
      latitude: 27.84,
      longitude: -97.05,
      caughtAt: "2026-08-02T14:00:00.000Z",
      tide: "incoming",
      tideHeightFt: 1.5,
    });
    const noGps = catchOf({
      id: "c-new",
      placeName: "Beach marker 42",
      latitude: null,
      longitude: null,
      caughtAt: "2026-08-09T18:30:00.000Z",
      tide: null,
      tideHeightFt: null,
    });
    expect(
      pinForPlannedSpot({ sourceCatchId: "c-new", placeName: "Beach marker 42" }, { catches: [withGps, noGps] }),
    ).toMatchObject({
      latitude: 27.84,
      longitude: -97.05,
      caughtAt: "2026-08-09T18:30:00.000Z",
      tideHeightFt: null,
    });
    const photoOnly = catchOf({
      id: "c-photo",
      placeName: "Beach marker 42",
      latitude: null,
      longitude: null,
      photoTakenLatitude: 27.838,
      photoTakenLongitude: -97.072,
      caughtAt: "2026-08-03T12:00:00.000Z",
    });
    expect(pinForPlannedSpot({ sourceCatchId: "c-photo" }, { catches: [photoOnly] })).toMatchObject({
      latitude: 27.838,
      longitude: -97.072,
    });
  });
});

describe("planned day and photo tide labels", () => {
  it("prints that day's high/low header", () => {
    const detail = plannedDayTideDetail(snap, -80.63);
    expect(detail).toContain("High");
    expect(detail).toContain("Low");
  });

  it("shows the plan-day clock when height matches a catch just after High, not a distant Low", () => {
    const pin = {
      latitude: 28.41,
      longitude: -80.63,
      habitat: "saltwater-inshore" as const,
      caughtAt: "2026-09-01T12:14:00.000Z",
      tideHeightFt: 4.5,
      tide: "outgoing",
    };
    const label = plannedSpotSameTide(snap, "2026-10-10", pin);
    expect(label).toMatch(/outgoing/i);
    expect(label).not.toMatch(/incoming/i);
    expect(label).not.toMatch(/^Low\b/);
    expect(label).not.toContain("1:46 AM");
    expect(label).not.toContain("2:46 PM");
    // High 8:09 AM EDT (12:09Z) 4.7ft → Low 2:46 PM (18:46Z) 0.6ft at 4.5ft
    expect(label).toBe("8:28 AM outgoing");
    expect(
      plannedSpotSameTide({ ...snap, applies: false }, "2026-10-10", pin),
    ).toBe("");
  });

  it("picks matching incoming/outgoing and never the opposite equal-height time", () => {
    const incoming = plannedSpotSameTide(snap, "2026-10-10", {
      latitude: 28.41,
      longitude: -80.63,
      habitat: "saltwater-inshore",
      caughtAt: "2026-09-01T11:50:00.000Z",
      tideHeightFt: 4.5,
      tide: "incoming",
    });
    const outgoing = plannedSpotSameTide(snap, "2026-10-10", {
      latitude: 28.41,
      longitude: -80.63,
      habitat: "saltwater-inshore",
      caughtAt: "2026-09-01T12:14:00.000Z",
      tideHeightFt: 4.5,
      tide: "outgoing",
    });
    expect(incoming).toBe("7:50 AM incoming");
    expect(outgoing).toBe("8:28 AM outgoing");
    expect(incoming).not.toEqual(outgoing);
    expect(incoming).not.toMatch(/outgoing/i);
    expect(outgoing).not.toMatch(/incoming/i);
    expect(
      plannedSpotSameTide(
        { ...snap, tide: "outgoing", heightFt: 2.7 },
        "2026-10-10",
        {
          latitude: 28.41,
          longitude: -80.63,
          habitat: "saltwater-inshore",
          caughtAt: "2026-09-01T11:50:00.000Z",
          tideHeightFt: 4.5,
          tide: "incoming",
        },
      ),
    ).toBe("7:50 AM incoming");
  });

  it("chips every planned Redfish row at the same hole, including stored heights off that day's range", () => {
    const aransas: TideSnapshot = {
      applies: true,
      tide: "incoming",
      heightFt: 1.4,
      nextHighAt: "2026-10-09T20:35:00.000Z",
      nextHighFt: 2.2,
      nextLowAt: "2026-10-09T13:32:00.000Z",
      nextLowFt: 1.0,
      source: "noaa",
      note: "",
      extremes: [
        { at: "2026-10-09T13:32:00.000Z", type: "low", heightFt: 1.0 },
        { at: "2026-10-09T20:35:00.000Z", type: "high", heightFt: 2.2 },
        { at: "2026-10-10T02:10:00.000Z", type: "low", heightFt: 0.9 },
      ],
    };
    const catches = [1, 2, 3, 4, 5].map((n) =>
      catchOf({
        id: `c-red-${n}`,
        placeName: "Beach marker 42",
        habitat: "saltwater-inshore",
        latitude: 27.84,
        longitude: -97.05,
        caughtAt: `2026-09-0${n}T14:00:00.000Z`,
        tide: n === 5 ? "outgoing" : "incoming",
        tideHeightFt: n === 1 ? 1.5 : n === 5 ? 1.8 : 4.5,
      }),
    );
    const spots = uniqueNotesByPlace(
      catches.map((row) => ({
        id: `note-${row.id}`,
        placeName: row.placeName,
        sourceCatchId: row.id,
        kind: "plan-spot" as const,
      })),
    );
    expect(spots).toHaveLength(5);
    const chips = sameTideChipsForSpots(spots, aransas, "2026-10-09", { catches });
    expect(Object.keys(chips)).toHaveLength(5);
    for (const spot of spots) {
      expect(chips[spot.id]).toBeTruthy();
      expect(chips[spot.id]).not.toMatch(/^Low\b/);
    }
    expect(chips["note-c-red-5"]).toMatch(/outgoing/i);
    expect(chips["note-c-red-1"]).toMatch(/incoming/i);

    const liveLike = uniqueNotesByPlace(
      [1, 2, 3, 4, 5].map((n) => ({
        id: `live-${n}`,
        placeName: "Beach marker 42",
        sourceCatchId: `live-c-${n}`,
        kind: "plan-spot" as const,
      })),
    );
    const liveCatches = [1, 2, 3, 4, 5].map((n) =>
      catchOf({
        id: `live-c-${n}`,
        placeName: "Beach marker 42",
        habitat: "saltwater-inshore",
        latitude: 27.84,
        longitude: -97.05,
        caughtAt: `2026-08-0${n}T15:00:00.000Z`,
        tide: n === 2 ? "incoming" : null,
        tideHeightFt: n === 2 ? 1.45 : n % 2 === 0 ? 4.5 : null,
      }),
    );
    const liveChips = sameTideChipsForSpots(liveLike, aransas, "2026-10-09", { catches: liveCatches });
    expect(liveLike).toHaveLength(5);
    expect(Object.keys(liveChips)).toHaveLength(5);
    expect(liveChips["live-2"]).toMatch(/incoming/i);

    const noHabitat = uniqueNotesByPlace(
      [1, 2, 3, 4, 5].map((n) => ({
        id: `hab-${n}`,
        placeName: "Beach marker 42",
        sourceCatchId: `hab-c-${n}`,
        kind: "plan-spot" as const,
      })),
    );
    const noHabitatCatches = [1, 2, 3, 4, 5].map((n) => ({
      ...catchOf({
        id: `hab-c-${n}`,
        placeName: "Beach marker 42",
        latitude: 27.84,
        longitude: -97.05,
        caughtAt: `2026-08-0${n}T14:3${n}:00.000Z`,
        tide: null,
        tideHeightFt: n === 3 ? 4.5 : null,
      }),
      habitat: null,
    }));
    const noHabitatChips = sameTideChipsForSpots(noHabitat, aransas, "2026-10-09", {
      catches: noHabitatCatches,
    });
    expect(Object.keys(noHabitatChips)).toHaveLength(5);
    for (const spot of noHabitat) {
      expect(noHabitatChips[spot.id]).toBeTruthy();
    }
  });

  it("uses a catch-time station snapshot so a stored 4.5 ft height still chips on a 2.2 ft day", () => {
    const pin = {
      latitude: 27.84,
      longitude: -97.05,
      habitat: "saltwater-inshore" as const,
      caughtAt: "2026-09-03T14:30:00.000Z",
      tideHeightFt: 4.5,
      tide: null,
    };
    const daySnap: TideSnapshot = {
      ...snap,
      nextHighAt: "2026-10-09T20:35:00.000Z",
      nextHighFt: 2.2,
      nextLowAt: "2026-10-09T13:32:00.000Z",
      nextLowFt: 1.0,
      extremes: [
        { at: "2026-10-09T13:32:00.000Z", type: "low", heightFt: 1.0 },
        { at: "2026-10-09T20:35:00.000Z", type: "high", heightFt: 2.2 },
      ],
    };
    expect(plannedSpotSameTide(daySnap, "2026-10-09", pin)).toMatch(/incoming|High/);
    const resolved = applyCatchTideSnapshot(pin, {
      applies: true,
      tide: "incoming",
      heightFt: 1.4,
      nextHighAt: null,
      nextHighFt: null,
      nextLowAt: null,
      nextLowFt: null,
      source: "noaa",
      note: "",
    });
    expect(resolved.tideHeightFt).toBe(1.4);
    expect(resolved.tide).toBe("incoming");
    expect(plannedSpotSameTide(daySnap, "2026-10-09", resolved)).toMatch(/incoming/i);
    expect(
      plannedSpotSameTide(daySnap, "2026-10-09", {
        ...pin,
        habitat: null,
        tide: null,
        tideHeightFt: null,
      }),
    ).toMatch(/incoming|outgoing|High|Low/);
  });

  it("chips every Oct 9 and Oct 10 planned photo when only the header High/Low loaded", () => {
    const headerOnly: TideSnapshot = {
      applies: true,
      tide: null,
      heightFt: null,
      nextHighAt: "2026-10-09T20:35:00.000Z",
      nextHighFt: 2.2,
      nextLowAt: "2026-10-09T13:32:00.000Z",
      nextLowFt: 1.0,
      source: "noaa",
      note: "",
      stationName: "Port Aransas (H. Caldwell Pier)",
    };
    expect(fallbackChipFromDayTides(headerOnly, "2026-10-09", "America/Chicago")).toBeTruthy();
    expect(plannedSpotSameTide(headerOnly, "2026-10-09", null)).toBe("");

    const oct9 = uniqueNotesByPlace([
      ...[1, 2, 3, 4, 5].map((n) => ({
        id: `oct9-red-${n}`,
        placeName: "Beach marker 42",
        sourceCatchId: `oct9-c-red-${n}`,
        kind: "plan-spot" as const,
      })),
      {
        id: "oct9-blacktip",
        placeName: "Beach marker 42",
        sourceCatchId: "oct9-c-blacktip",
        kind: "plan-spot" as const,
      },
    ]);
    const oct9Catches = [
      ...[1, 2, 3, 4, 5].map((n) =>
        catchOf({
          id: `oct9-c-red-${n}`,
          placeName: "Beach marker 42",
          species: "Redfish",
          latitude: n === 2 ? 27.838 : null,
          longitude: n === 2 ? -97.072 : null,
          caughtAt: n === 2 ? "2026-08-02T14:13:00.000Z" : `2026-08-0${n}T00:00:00.000Z`,
          tide: n === 2 ? "incoming" : null,
          tideHeightFt: n === 2 ? 1.45 : null,
        }),
      ),
      catchOf({
        id: "oct9-c-blacktip",
        placeName: "Beach marker 42",
        species: "Blacktip",
        latitude: null,
        longitude: null,
        caughtAt: "2026-08-06T18:00:00.000Z",
        tide: null,
        tideHeightFt: null,
      }),
    ];
    const oct9Chips = sameTideChipsForSpots(oct9, headerOnly, "2026-10-09", { catches: oct9Catches });
    expect(oct9).toHaveLength(6);
    expect(Object.keys(oct9Chips)).toHaveLength(6);
    for (const spot of oct9) {
      expect(oct9Chips[spot.id]).toBeTruthy();
    }

    const oct10Snap: TideSnapshot = {
      applies: true,
      tide: "outgoing",
      heightFt: 1.2,
      nextHighAt: "2026-10-10T21:46:00.000Z",
      nextHighFt: 2.4,
      nextLowAt: "2026-10-10T14:00:00.000Z",
      nextLowFt: 0.8,
      source: "noaa",
      note: "",
      stationName: "Port Aransas (H. Caldwell Pier)",
      extremes: [
        { at: "2026-10-10T14:00:00.000Z", type: "low", heightFt: 0.8 },
        { at: "2026-10-10T21:46:00.000Z", type: "high", heightFt: 2.4 },
      ],
    };
    const oct10 = uniqueNotesByPlace([
      { id: "o10-1", placeName: "Port Aransas, Texas", sourceCatchId: "o10-c1", kind: "plan-spot" as const },
      { id: "o10-2", placeName: "Beach marker 42", sourceCatchId: "o10-c2", kind: "plan-spot" as const },
      { id: "o10-3", placeName: "Port Aransas, Texas", sourceCatchId: "o10-c3", kind: "plan-spot" as const },
      { id: "o10-4", placeName: "Beach marker 42", sourceCatchId: "o10-c4", kind: "plan-spot" as const },
      { id: "o10-5", placeName: "Beach marker 42", sourceCatchId: "o10-c5", kind: "plan-spot" as const },
    ]);
    const oct10Catches = [
      catchOf({
        id: "o10-c1",
        placeName: "Port Aransas, Texas",
        species: "Blacktip",
        latitude: 27.84,
        longitude: -97.05,
        caughtAt: "2026-07-01T11:20:00.000Z",
        tide: "outgoing",
        tideHeightFt: 1.6,
      }),
      catchOf({
        id: "o10-c2",
        placeName: "Beach marker 42",
        species: "Shark",
        latitude: 27.84,
        longitude: -97.05,
        caughtAt: "2026-07-02T11:24:00.000Z",
        tide: "outgoing",
        tideHeightFt: 1.5,
      }),
      catchOf({
        id: "o10-c3",
        placeName: "Port Aransas, Texas",
        species: "Blacktip",
        latitude: 27.84,
        longitude: -97.05,
        caughtAt: "2026-07-03T10:29:00.000Z",
        tide: "outgoing",
        tideHeightFt: 1.4,
      }),
      catchOf({
        id: "o10-c4",
        placeName: "Beach marker 42",
        species: "Blacktip shark",
        latitude: 27.84,
        longitude: -97.05,
        caughtAt: "2026-07-04T22:47:00.000Z",
        tide: "outgoing",
        tideHeightFt: 1.7,
      }),
      catchOf({
        id: "o10-c5",
        placeName: "Beach marker 42",
        species: "Blacktip",
        latitude: null,
        longitude: null,
        photoTakenLatitude: null,
        photoTakenLongitude: null,
        caughtAt: "",
        tide: null,
        tideHeightFt: null,
      }),
    ];
    const oct10Chips = sameTideChipsForSpots(oct10, oct10Snap, "2026-10-10", { catches: oct10Catches });
    expect(oct10).toHaveLength(5);
    expect(Object.keys(oct10Chips)).toHaveLength(5);
    expect(oct10Chips["o10-5"]).toBeTruthy();
  });

  it("gives a second and third catch their own chips on a day that already has a plan", () => {
    const oct9: TideSnapshot = {
      applies: true,
      tide: "incoming",
      heightFt: 1.4,
      nextHighAt: "2026-10-09T20:35:00.000Z",
      nextHighFt: 2.2,
      nextLowAt: "2026-10-09T13:32:00.000Z",
      nextLowFt: 1.0,
      source: "noaa",
      note: "",
      extremes: [
        { at: "2026-10-09T13:32:00.000Z", type: "low", heightFt: 1.0 },
        { at: "2026-10-09T20:35:00.000Z", type: "high", heightFt: 2.2 },
        { at: "2026-10-10T02:10:00.000Z", type: "low", heightFt: 0.9 },
      ],
    };
    const first = catchOf({
      id: "c-first",
      placeName: "Beach marker 42",
      habitat: "saltwater-inshore",
      latitude: 27.84,
      longitude: -97.05,
      caughtAt: "2026-08-02T14:13:00.000Z",
      tide: "incoming",
      tideHeightFt: 1.45,
    });
    const second = catchOf({
      id: "c-second",
      placeName: "North wind spot",
      habitat: "saltwater-inshore",
      latitude: 27.85,
      longitude: -97.06,
      caughtAt: "2026-07-15T18:00:00.000Z",
      tide: "outgoing",
      tideHeightFt: null,
    });
    const third = catchOf({
      id: "c-third",
      placeName: "Demagnetizer",
      habitat: "saltwater-inshore",
      latitude: 27.83,
      longitude: -97.04,
      caughtAt: "2026-06-01T16:40:00.000Z",
      tide: "incoming",
      tideHeightFt: 1.8,
    });
    const spots = [
      { id: "n1", placeName: first.placeName, sourceCatchId: first.id },
      { id: "n2", placeName: second.placeName, sourceCatchId: second.id },
      { id: "n3", placeName: third.placeName, sourceCatchId: third.id },
    ];
    const journal = { catches: [first, second, third] };
    const firstPin = pinForPlannedSpot(spots[0], journal);
    const leftoverLow = fallbackChipFromDayTides(
      { ...oct9, heightFt: null },
      "2026-10-09",
      "America/Chicago",
    );
    const staleSnaps = {
      [catchTideLookupKey(firstPin)!]: {
        applies: true,
        tide: "incoming" as const,
        heightFt: 1.45,
        nextHighAt: null,
        nextHighFt: null,
        nextLowAt: null,
        nextLowFt: null,
        source: "noaa" as const,
        note: "",
      },
    };
    const chips = sameTideChipsForSpots(spots, oct9, "2026-10-09", journal, staleSnaps);
    expect(leftoverLow).toMatch(/^Low\b/);
    expect(chips.n1).toBeTruthy();
    expect(chips.n2).toBeTruthy();
    expect(chips.n3).toBeTruthy();
    expect(chips.n2).not.toBe(chips.n1);
    expect(chips.n3).not.toBe(chips.n1);
    expect(chips.n3).not.toBe(chips.n2);
    expect(chips.n2).not.toBe(leftoverLow);
    expect(chips.n3).not.toBe(leftoverLow);
    expect(chips.n2).not.toMatch(/^Low\b/);
    expect(chips.n3).not.toMatch(/^Low\b/);
    expect(plannedSpotTideRefreshKey([spots[0]], journal)).not.toBe(
      plannedSpotTideRefreshKey([spots[0], spots[1]], journal),
    );
    expect(plannedSpotTideRefreshKey([spots[0], spots[1]], journal)).toContain(second.id);
  });

  it("keeps Sep 23-style distinct incoming chips when more catches are added to that same plan day", () => {
    // John: Ship channel 8:33 AM incoming vs Light house lakes 9:17 AM incoming.
    const ingleside: TideSnapshot = {
      applies: true,
      tide: "incoming",
      heightFt: 0.5,
      nextHighAt: "2026-09-23T17:59:00.000Z",
      nextHighFt: 0.8,
      nextLowAt: "2026-09-24T04:28:00.000Z",
      nextLowFt: 0.3,
      source: "noaa",
      note: "",
      stationName: "Enbridge, Ingleside",
      extremes: [
        { at: "2026-09-23T11:00:00.000Z", type: "low", heightFt: 0.3 },
        { at: "2026-09-23T17:59:00.000Z", type: "high", heightFt: 0.8 },
        { at: "2026-09-24T04:28:00.000Z", type: "low", heightFt: 0.3 },
      ],
    };
    const ship = catchOf({
      id: "c-ship",
      placeName: "Ship channel",
      species: "Black Drum",
      habitat: "saltwater-inshore",
      latitude: 27.877,
      longitude: -97.211,
      caughtAt: "2026-07-04T13:33:00.000Z",
      tide: "incoming",
      tideHeightFt: 0.483,
    });
    const lighthouse = catchOf({
      id: "c-lighthouse",
      placeName: "Light house lakes",
      species: "Redfish",
      habitat: "saltwater-inshore",
      latitude: 27.88,
      longitude: -97.21,
      caughtAt: "2026-08-11T14:17:00.000Z",
      tide: "incoming",
      tideHeightFt: 0.536,
    });
    const firstTwo = [
      { id: "n-ship", placeName: ship.placeName, sourceCatchId: ship.id },
      { id: "n-light", placeName: lighthouse.placeName, sourceCatchId: lighthouse.id },
    ];
    const firstChips = sameTideChipsForSpots(firstTwo, ingleside, "2026-09-23", {
      catches: [ship, lighthouse],
    });
    expect(firstChips["n-ship"]).toBe("8:33 AM incoming");
    expect(firstChips["n-light"]).toBe("9:17 AM incoming");
    expect(firstChips["n-ship"]).not.toEqual(firstChips["n-light"]);
    expect(firstChips["n-ship"]).not.toMatch(/^Low\b/);
    expect(firstChips["n-light"]).not.toMatch(/^Low\b/);

    const shark = catchOf({
      id: "c-shark",
      placeName: "Beach",
      species: "Shark",
      habitat: "saltwater-inshore",
      latitude: 27.84,
      longitude: -97.05,
      caughtAt: "2026-06-20T15:10:00.000Z",
      tide: "incoming",
      tideHeightFt: null,
    });
    const trout = catchOf({
      id: "c-trout",
      placeName: "Beach marker 42",
      species: "Speckled Trout",
      habitat: "saltwater-inshore",
      latitude: 27.838,
      longitude: -97.072,
      caughtAt: "2026-05-02T12:40:00.000Z",
      tide: "incoming",
      tideHeightFt: null,
    });
    const afterAdds = [
      ...firstTwo,
      { id: "n-shark", placeName: shark.placeName, sourceCatchId: shark.id },
      { id: "n-trout", placeName: trout.placeName, sourceCatchId: trout.id },
    ];
    const leftoverLow = fallbackChipFromDayTides(
      { ...ingleside, heightFt: null },
      "2026-09-23",
      "America/Chicago",
    );
    const shipPin = pinForPlannedSpot(firstTwo[0], { catches: [ship, lighthouse, shark, trout] });
    const staleSnaps = {
      [catchTideLookupKey(shipPin)!]: {
        applies: true,
        tide: "incoming" as const,
        heightFt: 0.483,
        nextHighAt: null,
        nextHighFt: null,
        nextLowAt: null,
        nextLowFt: null,
        source: "noaa" as const,
        note: "",
      },
    };
    const chips = sameTideChipsForSpots(
      afterAdds,
      ingleside,
      "2026-09-23",
      { catches: [ship, lighthouse, shark, trout] },
      staleSnaps,
    );
    expect(leftoverLow).toMatch(/^Low\b/);
    expect(chips["n-ship"]).toBe("8:33 AM incoming");
    expect(chips["n-light"]).toBe("9:17 AM incoming");
    expect(chips["n-shark"]).toBeTruthy();
    expect(chips["n-trout"]).toBeTruthy();
    expect(chips["n-shark"]).toMatch(/incoming/i);
    expect(chips["n-trout"]).toMatch(/incoming/i);
    expect(chips["n-shark"]).not.toBe(chips["n-ship"]);
    expect(chips["n-trout"]).not.toBe(chips["n-ship"]);
    expect(chips["n-shark"]).not.toBe(chips["n-light"]);
    expect(chips["n-trout"]).not.toBe(chips["n-light"]);
    expect(chips["n-shark"]).not.toBe(chips["n-trout"]);
    expect(chips["n-shark"]).not.toBe(leftoverLow);
    expect(chips["n-trout"]).not.toBe(leftoverLow);
    expect(chips["n-shark"]).not.toMatch(/^Low\b/);
    expect(chips["n-trout"]).not.toMatch(/^Low\b/);
  });

  it("chips Oct 11 Enbridge catches with interpolated incoming, not a leftover Low 2:42 PM", () => {
    // John: High 1:22 AM 1.0 ft · Low 1:22 PM 0.3 ft · Enbridge, Ingleside.
    // NOAA window also has Oct 10 Low 2:42 PM — that must not become the second fish's chip.
    const inglesideOct11: TideSnapshot = {
      applies: true,
      tide: "outgoing",
      heightFt: 0.7,
      nextHighAt: "2026-10-11T06:22:00.000Z",
      nextHighFt: 1.0,
      nextLowAt: "2026-10-11T18:22:00.000Z",
      nextLowFt: 0.3,
      source: "noaa",
      note: "",
      stationName: "Enbridge, Ingleside",
      extremes: [
        { at: "2026-10-10T19:42:00.000Z", type: "low", heightFt: 0.15 },
        { at: "2026-10-11T06:22:00.000Z", type: "high", heightFt: 1.0 },
        { at: "2026-10-11T18:22:00.000Z", type: "low", heightFt: 0.3 },
        { at: "2026-10-12T00:22:00.000Z", type: "high", heightFt: 0.9 },
      ],
    };
    const leftoverLow = fallbackChipFromDayTides(
      { ...inglesideOct11, heightFt: null },
      "2026-10-11",
      "America/Chicago",
    );
    const ship = catchOf({
      id: "c-ship-drum",
      placeName: "Ship channel",
      species: "Black Drum",
      habitat: "saltwater-inshore",
      latitude: 27.877,
      longitude: -97.211,
      caughtAt: "2026-07-04T19:19:00.000Z",
      tide: "incoming",
      tideHeightFt: 0.395,
    });
    const flounder = catchOf({
      id: "c-demag-flounder",
      placeName: "Demagnetizer",
      species: "Flounder",
      habitat: "saltwater-inshore",
      latitude: 27.87,
      longitude: -97.2,
      caughtAt: "2026-08-09T16:40:00.000Z",
      tide: "incoming",
      tideHeightFt: 0.15,
    });
    const firstOnly = [{ id: "n-ship", placeName: ship.placeName, sourceCatchId: ship.id }];
    const firstChips = sameTideChipsForSpots(firstOnly, inglesideOct11, "2026-10-11", {
      catches: [ship],
    });
    expect(firstChips["n-ship"]).toBe("2:19 PM incoming");
    expect(firstChips["n-ship"]).not.toMatch(/^Low\b/);

    const afterSecond = [
      { id: "n-demag", placeName: flounder.placeName, sourceCatchId: flounder.id },
      ...firstOnly,
    ];
    const shipPin = pinForPlannedSpot(firstOnly[0], { catches: [ship, flounder] });
    const staleSnaps = {
      [catchTideLookupKey(shipPin)!]: {
        applies: true,
        tide: "incoming" as const,
        heightFt: 0.395,
        nextHighAt: null,
        nextHighFt: null,
        nextLowAt: null,
        nextLowFt: null,
        source: "noaa" as const,
        note: "",
      },
    };
    const chips = sameTideChipsForSpots(
      afterSecond,
      inglesideOct11,
      "2026-10-11",
      { catches: [ship, flounder] },
      staleSnaps,
    );
    expect(plannedDayTideDetail(inglesideOct11, -97.21)).toContain("High 1:22 AM 1.0 ft");
    expect(plannedDayTideDetail(inglesideOct11, -97.21)).toContain("Low 1:22 PM 0.3 ft");
    expect(chips["n-ship"]).toBe("2:19 PM incoming");
    expect(chips["n-demag"]).toBeTruthy();
    expect(chips["n-demag"]).not.toBe(chips["n-ship"]);
    expect(chips["n-demag"]).not.toBe(leftoverLow);
    expect(chips["n-demag"]).not.toMatch(/^Low\b/);
    expect(chips["n-demag"]).not.toContain("2:42 PM");
    expect(chips["n-demag"]).toMatch(/incoming|outgoing/i);

    const flounderPin = pinForPlannedSpot(afterSecond[0], { catches: [ship, flounder] });
    const withCatchSnap = sameTideChipsForSpots(
      afterSecond,
      inglesideOct11,
      "2026-10-11",
      { catches: [ship, flounder] },
      {
        ...staleSnaps,
        [catchTideLookupKey(flounderPin)!]: {
          applies: true,
          tide: "incoming" as const,
          heightFt: 0.45,
          nextHighAt: "2026-08-09T21:00:00.000Z",
          nextHighFt: 1.1,
          nextLowAt: "2026-08-09T14:00:00.000Z",
          nextLowFt: 0.1,
          source: "noaa" as const,
          note: "",
          extremes: [
            { at: "2026-08-09T14:00:00.000Z", type: "low", heightFt: 0.1 },
            { at: "2026-08-09T21:00:00.000Z", type: "high", heightFt: 1.1 },
          ],
        },
      },
    );
    expect(withCatchSnap["n-ship"]).toBe("2:19 PM incoming");
    expect(withCatchSnap["n-demag"]).toBeTruthy();
    expect(withCatchSnap["n-demag"]).not.toBe(withCatchSnap["n-ship"]);
    expect(withCatchSnap["n-demag"]).not.toMatch(/^Low\b/);
    expect(withCatchSnap["n-demag"]).toMatch(/incoming/i);
  });
});


describe("Plan Planned panel wires day tides", () => {
  it("shows the planned day's tides and a closest tide on each photo row", () => {
    const plan = readFileSync(resolve(__dirname, "../components/PlanClient.tsx"), "utf8");
    expect(plan).toContain("plannedDayTideDetail");
    expect(plan).toContain("sameTideChipsForSpots");
    expect(plan).toContain("sameTideById");
    expect(plan).toContain("sameTideChipsForSpots");
    expect(plan).toContain("fallbackChipFromDayTides");
    expect(plan).toContain("catchTideLookupKey");
    expect(plan).toContain("plannedSpotTideRefreshKey");
    expect(plan).toContain("catchTideLookupsForSpots");
    expect(plan).toContain("plannedCatchIds");
    expect(plan).toContain("/api/catches/${id}");
    expect(plan).toContain("scrollPlanResultsBelowStatusBar");
    expect(plan).toContain("plan-day-results");
    expect(plan).toContain("plan-planned-header");
    expect(plan).toContain("/api/catches/${catchId}");
    expect(plan).not.toContain('scrollIntoView({ behavior: "smooth", block: "start" })');
    expect(plan).not.toContain("setPlanTides({ detail, snap, catchSnaps: {} })");
    expect(plan).not.toContain("spotsTideKey");
    expect(plan).not.toContain("tideHeightFt == null &&");
    expect(plan).not.toContain("plannedSpotClosestTide");
    expect(plan).not.toContain("closestCivilDayTide");
    expect(plan).toContain("pinForPlannedSpot");
    expect(plan).toContain("/api/assist/weather");
    expect(plan).toContain('data-testid="plan-day-tides"');
    expect(plan).toContain('data-testid="plan-day-spot-tide"');
    expect(plan).toContain('data-testid="plan-day-spot-tide-label"');
    expect(plan).toContain("matching tide");
    const tides = readFileSync(resolve(__dirname, "./plan-tides.ts"), "utf8");
    expect(tides).toContain("tideHeightRangeForDay");
    expect(tides).toContain("remapHeightToRange");
    expect(tides).toContain("mappedClockChip");
    expect(tides).not.toContain("sameTideCrossings(extremes, clamped)");
    expect(plan).toContain("selectPlanDay");
    expect(plan).toContain("data-no-tab-swipe");
    expect(plan).toContain('type="button"');
  });
});
