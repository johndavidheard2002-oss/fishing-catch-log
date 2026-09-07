import { describe, expect, it } from "vitest";
import { groupSpots } from "./filters";
import {
  baitPlanHeadline,
  collapseBaitMatchesByPlace,
  dedupeBaitSuggestionsByPlace,
  distinctPlanPlaces,
  forecastWindowWhenLabel,
  isPositiveCatch,
  parsePlanDate,
  LAST_PLAN_DAY_STORAGE_KEY,
  readLastPlanDay,
  writeLastPlanDay,
  planHeadline,
  planLookupFailureNote,
  planPlaceToAdd,
  planWhyChips,
  scoreWindowAgainstBait,
  scoreWindowAgainstCatch,
  splitBaitSuggestionByPlace,
  splitPlanSuggestionByPlace,
  suggestionStrength,
  suggestBaitFromWindows,
  suggestFromWindows,
  uniqueNotesByPlace,
} from "./plan";
import { baitOf, catchOf } from "./testing";
import { formatTimeOnly } from "./time";
import type { BaitSpot, CatchRecord, ForecastWindow } from "./types";

function pondCatch(partial: Partial<CatchRecord> & { id: string }): CatchRecord {
  return catchOf({
    latitude: 40.212,
    longitude: -82.891,
    placeName: "Farm Pond, OH",
    temperatureF: 76,
    weatherCondition: "cloudy",
    windSpeedMph: 5,
    humidity: 61,
    bait: "Senko",
    waterClarity: "clear",
    caughtAt: "2025-06-22T19:05:00.000Z",
    createdAt: "2025-06-22T19:05:00.000Z",
    updatedAt: "2025-06-22T19:05:00.000Z",
    ...partial,
  });
}

function windowOf(partial: Partial<ForecastWindow>): ForecastWindow {
  return {
    at: "2026-09-03T19:00:00.000Z",
    date: "2026-09-03",
    timeOfDay: "afternoon",
    season: "fall",
    latitude: 40.212,
    longitude: -82.891,
    temperatureF: 74,
    weatherCondition: "cloudy",
    windSpeedMph: 6,
    windDirection: "SW",
    precipitationIn: 0,
    humidity: 60,
    moonPhase: "Waxing gibbous",
    moonIllumination: 70,
    pressureInHg: 29.96,
    pressureMb: 1014.5,
    pressureTrend: "steady",
    tide: null,
    tideHeightFt: null,
    weatherSource: "demo",
    tideSource: "none",
    ...partial,
  };
}

describe("isPositiveCatch", () => {
  it("keeps logged fish and drops empty labels", () => {
    expect(isPositiveCatch(pondCatch({ id: "1" }))).toBe(true);
    expect(isPositiveCatch(pondCatch({ id: "2", species: "Unknown" }))).toBe(false);
    expect(isPositiveCatch(pondCatch({ id: "3", species: "skunk" }))).toBe(false);
  });
});

describe("scoreWindowAgainstCatch", () => {
  it("scores cloudy + ~72°F + afternoon like the Farm Pond bass", () => {
    const match = scoreWindowAgainstCatch(
      windowOf({ temperatureF: 72, weatherCondition: "cloudy", timeOfDay: "afternoon" }),
      pondCatch({ id: "bass" }),
    );
    expect(match.score).toBeGreaterThanOrEqual(30);
    expect(match.reasons).toEqual(
      expect.arrayContaining(["Same time of day", "Cloudy"]),
    );
  });

  it("adds tide agreement for coastal history", () => {
    const redfish = catchOf({
      id: "red",
      species: "Redfish",
      placeName: "Mosquito Lagoon, FL",
      tide: "incoming",
      timeOfDay: "dusk",
      weatherCondition: "partly-cloudy",
      temperatureF: 82,
    });
    const withTide = scoreWindowAgainstCatch(
      windowOf({
        timeOfDay: "dusk",
        weatherCondition: "partly-cloudy",
        temperatureF: 80,
        tide: "incoming",
      }),
      redfish,
    );
    const without = scoreWindowAgainstCatch(
      windowOf({
        timeOfDay: "dusk",
        weatherCondition: "partly-cloudy",
        temperatureF: 80,
        tide: "low",
      }),
      redfish,
    );
    expect(withTide.score).toBeGreaterThan(without.score);
    expect(withTide.reasons.some((r) => /same rising tide/i.test(r))).toBe(true);
  });

  it("marks exact tide + height + time as very-strong, not weather-only", () => {
    const redfish = catchOf({
      id: "red",
      species: "Redfish",
      placeName: "Mosquito Lagoon, FL",
      tide: "incoming",
      tideHeightFt: 2.1,
      timeOfDay: "dawn",
      caughtAt: "2025-07-12T10:40:00.000Z",
      weatherCondition: "partly-cloudy",
      temperatureF: 82,
    });
    const match = scoreWindowAgainstCatch(
      windowOf({
        at: "2026-09-03T10:42:00.000Z",
        timeOfDay: "dawn",
        weatherCondition: "partly-cloudy",
        temperatureF: 80,
        tide: "incoming",
        tideHeightFt: 2.0,
      }),
      redfish,
    );
    expect(match.strength).toBe("very-strong");
    expect(match.reasons[0]).toMatch(/same rising tide ~2\.1 ft/i);
    expect(match.reasons[0]).toContain("~");

    const weatherOnly = scoreWindowAgainstCatch(
      windowOf({ temperatureF: 72, weatherCondition: "cloudy", timeOfDay: "afternoon", tide: null }),
      pondCatch({ id: "bass" }),
    );
    expect(weatherOnly.strength).not.toBe("very-strong");
  });
});

describe("suggestFromWindows", () => {
  it("ranks the matching spot and points at the past catch", () => {
    const bass = pondCatch({ id: "bass" });
    const trout = catchOf({
      id: "trout",
      species: "Rainbow Trout",
      placeName: "Frying Pan River, CO",
      latitude: 39.368,
      longitude: -106.818,
      temperatureF: 48,
      weatherCondition: "cloudy",
      timeOfDay: "morning",
      season: "spring",
    });
    const spots = groupSpots([bass, trout]);
    const suggestions = suggestFromWindows({
      spots,
      windowsBySpotKey: {
        [spots.find((s) => s.placeName === "Farm Pond, OH")!.key]: [
          windowOf({ temperatureF: 72, weatherCondition: "cloudy" }),
        ],
        [spots.find((s) => s.placeName === "Frying Pan River, CO")!.key]: [
          windowOf({
            timeOfDay: "morning",
            temperatureF: 88,
            weatherCondition: "clear",
            latitude: 39.368,
            longitude: -106.818,
          }),
        ],
      },
    });
    expect(suggestions[0].placeName).toBe("Farm Pond, OH");
    expect(suggestions[0].matches[0].catch.id).toBe("bass");
    expect(suggestions[0].headline).toMatch(/cloudy \+ 72°F \+ afternoon like your Largemouth Bass/i);
    expect(suggestions[0].strength).not.toBe("very-strong");
    expect(suggestionStrength(suggestions[0].score)).not.toBeUndefined();
  });

  it("emits a separate suggestion for each nearby named place", () => {
    const cut = pondCatch({
      id: "cut",
      species: "Redfish",
      placeName: "Innertube cut",
      latitude: 28.738,
      longitude: -80.755,
      tide: "outgoing",
    });
    const point = pondCatch({
      id: "point",
      species: "Speckled Trout",
      placeName: "Ransom point",
      latitude: 28.740,
      longitude: -80.753,
      caughtAt: "2025-06-21T19:05:00.000Z",
      tide: "outgoing",
    });
    const other = pondCatch({
      id: "other",
      species: "Redfish",
      placeName: "Harbor island",
      latitude: 28.741,
      longitude: -80.752,
      caughtAt: "2025-06-20T19:05:00.000Z",
      tide: "outgoing",
    });
    const spots = groupSpots([cut, point, other]);
    expect(spots).toHaveLength(3);
    const window = windowOf({
      latitude: 28.738,
      longitude: -80.755,
      temperatureF: 76,
      weatherCondition: "cloudy",
      tide: "outgoing",
    });
    const windowsBySpotKey = Object.fromEntries(spots.map((spot) => [spot.key, [window]]));
    const suggestions = suggestFromWindows({ spots, windowsBySpotKey });
    const places = suggestions.map((s) => s.placeName).sort();
    expect(places).toEqual(["Harbor island", "Innertube cut", "Ransom point"]);
    for (const suggestion of suggestions) {
      expect(distinctPlanPlaces(suggestion)).toEqual([suggestion.placeName]);
      expect(planPlaceToAdd(suggestion)?.placeName).toBe(suggestion.placeName);
    }
  });

  it("keeps several past trips at the same place on one suggestion", () => {
    const first = pondCatch({ id: "a", placeName: "Innertube cut" });
    const second = pondCatch({
      id: "b",
      placeName: "Innertube cut",
      caughtAt: "2025-06-21T19:05:00.000Z",
    });
    const third = pondCatch({
      id: "c",
      placeName: "innertube  cut",
      caughtAt: "2025-06-20T19:05:00.000Z",
    });
    const spots = groupSpots([first, second, third]);
    expect(spots).toHaveLength(1);
    const suggestions = suggestFromWindows({
      spots,
      windowsBySpotKey: {
        [spots[0].key]: [windowOf({ temperatureF: 76, weatherCondition: "cloudy" })],
      },
    });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].matches).toHaveLength(3);
    expect(distinctPlanPlaces(suggestions[0])).toEqual(["Innertube cut"]);
    expect(planPlaceToAdd(suggestions[0])).toEqual({
      placeName: "Innertube cut",
      speciesTargets: ["Largemouth Bass", "Largemouth Bass", "Largemouth Bass"],
    });
  });
});

describe("splitPlanSuggestionByPlace", () => {
  it("splits a mixed-place card so each place gets its own Add payload", () => {
    const window = windowOf({ temperatureF: 76, weatherCondition: "cloudy" });
    const mixed = {
      id: "mixed",
      spotKey: "28.738,-80.755",
      placeName: "Innertube cut",
      latitude: 28.738,
      longitude: -80.755,
      window,
      score: 40,
      strength: "strong" as const,
      headline: "grouped",
      reasons: ["Same time of day"],
      matches: [
        {
          catch: pondCatch({ id: "cut", placeName: "Innertube cut" }),
          score: 40,
          reasons: ["Same time of day"],
          strength: "strong" as const,
        },
        {
          catch: pondCatch({ id: "point", placeName: "Ransom point" }),
          score: 38,
          reasons: ["Same time of day"],
          strength: "strong" as const,
        },
        {
          catch: pondCatch({ id: "island", placeName: "Harbor island" }),
          score: 36,
          reasons: ["Same time of day"],
          strength: "strong" as const,
        },
      ],
    };
    const cards = splitPlanSuggestionByPlace(mixed);
    expect(cards.map((card) => card.placeName).sort()).toEqual([
      "Harbor island",
      "Innertube cut",
      "Ransom point",
    ]);
    expect(cards.map((card) => planPlaceToAdd(card)?.placeName).sort()).toEqual([
      "Harbor island",
      "Innertube cut",
      "Ransom point",
    ]);
    expect(cards.every((card) => card.matches.length === 1)).toBe(true);
  });
});

describe("planHeadline", () => {
  it("names the past trip that drove the match", () => {
    const text = planHeadline(
      windowOf({ temperatureF: 72, weatherCondition: "cloudy", timeOfDay: "morning" }),
      pondCatch({ id: "x" }),
    );
    expect(text).toContain("Farm Pond, OH");
    expect(text).toContain("Largemouth Bass");
  });
});

describe("bait plan matches", () => {
  it("scores a similar tide and sky against a logged shrimp hole", () => {
    const shrimp: BaitSpot = {
      id: "shrimp-1",
      photoPath: null,
      placeName: "Haulover Canal",
      baitTypes: ["Shrimp"],
      latitude: 28.735,
      longitude: -80.754,
      temperatureF: 82,
      weatherCondition: "clear",
      windSpeedMph: 8,
      windDirection: "E",
      precipitationIn: 0,
      humidity: 70,
      moonPhase: null,
      moonIllumination: null,
      pressureInHg: 30.05,
      pressureMb: 1018,
      pressureTrend: "steady",
      loggedAt: "2026-08-02T14:00:00.000Z",
      timeOfDay: "afternoon",
      season: "summer",
      notes: null,
      tide: "incoming",
      tideHeightFt: 1.2,
      tideDetail: null,
      habitat: "saltwater-inshore",
      anglerId: "you",
      sharedWithLinked: false,
      sharedWithBuddyIds: [],
      ownerName: "You",
      createdAt: "2026-08-02T14:00:00.000Z",
      updatedAt: "2026-08-02T14:00:00.000Z",
    };
    const match = scoreWindowAgainstBait(
      windowOf({
        latitude: 28.735,
        longitude: -80.754,
        temperatureF: 81,
        weatherCondition: "clear",
        timeOfDay: "afternoon",
        tide: "incoming",
        tideHeightFt: 1.3,
        at: "2026-09-03T14:05:00.000Z",
      }),
      shrimp,
    );
    expect(match.score).toBeGreaterThanOrEqual(30);
    expect(match.strength).toBe("very-strong");
    expect(match.reasons[0]).toMatch(/same rising tide ~1\.2 ft/i);
    expect(baitPlanHeadline(windowOf({ weatherCondition: "clear", timeOfDay: "afternoon" }), shrimp)).toMatch(
      /shrimp at Haulover Canal/i,
    );
    const suggestions = suggestBaitFromWindows({
      groups: [
        {
          key: "bait:28.735,-80.754",
          placeName: "Haulover Canal",
          latitude: 28.735,
          longitude: -80.754,
          visitCount: 1,
          baitTypes: ["Shrimp"],
          lastLoggedAt: shrimp.loggedAt,
          typicalCondition: "clear",
          typicalTime: "afternoon",
          avgTempF: 82,
          spots: [shrimp],
        },
      ],
      windowsBySpotKey: {
        "bait:28.735,-80.754": [
          windowOf({
            latitude: 28.735,
            longitude: -80.754,
            temperatureF: 81,
            weatherCondition: "clear",
            timeOfDay: "afternoon",
            tide: "incoming",
            tideHeightFt: 1.3,
            at: "2026-09-03T14:05:00.000Z",
          }),
        ],
      },
    });
    expect(suggestions[0]?.placeName).toBe("Haulover Canal");
    expect(suggestions[0]?.baitTypes).toEqual(["Shrimp"]);
    expect(suggestions[0]?.strength).toBe("very-strong");
  });

  it("emits one card and one match for the same bait hole across windows and photos", () => {
    const first = baitOf({
      id: "photo-1",
      photoPath: "/uploads/bait-1.jpg",
      placeName: "Haulover Canal",
      timeOfDay: "morning",
      loggedAt: "2026-08-01T12:00:00.000Z",
    });
    const second = baitOf({
      id: "photo-2",
      photoPath: "/uploads/bait-2.jpg",
      placeName: "Haulover Canal",
      timeOfDay: "afternoon",
      loggedAt: "2026-08-02T16:00:00.000Z",
    });
    const third = baitOf({
      id: "photo-3",
      photoPath: "/uploads/bait-3.jpg",
      placeName: "haulover  canal",
      timeOfDay: "dusk",
      loggedAt: "2026-08-03T23:00:00.000Z",
    });
    const group = {
      key: "bait:28.735,-80.754",
      placeName: "Haulover Canal",
      latitude: 28.735,
      longitude: -80.754,
      visitCount: 3,
      baitTypes: ["Shrimp"],
      lastLoggedAt: third.loggedAt,
      typicalCondition: "clear" as const,
      typicalTime: "afternoon" as const,
      avgTempF: 82,
      spots: [first, second, third],
    };
    const matching = {
      latitude: 28.735,
      longitude: -80.754,
      temperatureF: 81,
      weatherCondition: "clear" as const,
      tide: "incoming" as const,
      tideHeightFt: 1.3,
    };
    const suggestions = suggestBaitFromWindows({
      groups: [group],
      windowsBySpotKey: {
        "bait:28.735,-80.754": [
          windowOf({ ...matching, date: "2026-09-03", timeOfDay: "morning", at: "2026-09-03T12:00:00.000Z" }),
          windowOf({ ...matching, date: "2026-09-03", timeOfDay: "afternoon", at: "2026-09-03T18:00:00.000Z" }),
          windowOf({ ...matching, date: "2026-09-03", timeOfDay: "dusk", at: "2026-09-03T23:30:00.000Z" }),
        ],
      },
    });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].placeName).toBe("Haulover Canal");
    expect(suggestions[0].matches).toHaveLength(1);
    expect(suggestions[0].matches[0].baitSpot.placeName).toMatch(/haulover/i);
  });
});

describe("dedupeBaitSuggestionsByPlace", () => {
  it("keeps the best card when the same bait is split across windows", () => {
    const hole = baitOf({ id: "hole", placeName: "Haulover Canal" });
    const morning = {
      id: "bait|hole|haulover canal|2026-09-03|morning",
      spotKey: "bait:28.735,-80.754",
      placeName: "Haulover Canal",
      baitTypes: ["Shrimp"],
      latitude: 28.735,
      longitude: -80.754,
      window: windowOf({ timeOfDay: "morning", at: "2026-09-03T12:00:00.000Z" }),
      score: 40,
      strength: "strong" as const,
      headline: "morning",
      reasons: ["Same time of day"],
      matches: [
        { baitSpot: hole, score: 40, reasons: ["Same time of day"], strength: "strong" as const },
        {
          baitSpot: baitOf({ id: "hole-photo-2", placeName: "Haulover Canal", photoPath: "/b2.jpg" }),
          score: 38,
          reasons: ["Same time of day"],
          strength: "strong" as const,
        },
        {
          baitSpot: baitOf({ id: "hole-photo-3", placeName: "Haulover Canal", photoPath: "/b3.jpg" }),
          score: 36,
          reasons: ["Same time of day"],
          strength: "strong" as const,
        },
      ],
    };
    const afternoon = {
      ...morning,
      id: "bait|hole|haulover canal|2026-09-03|afternoon",
      window: windowOf({ timeOfDay: "afternoon" }),
      score: 48,
      strength: "very-strong" as const,
      headline: "afternoon",
    };
    const dusk = {
      ...morning,
      id: "bait|hole|haulover canal|2026-09-03|dusk",
      window: windowOf({ timeOfDay: "dusk" }),
      score: 30,
      headline: "dusk",
    };
    const cards = dedupeBaitSuggestionsByPlace(
      [morning, afternoon, dusk].flatMap(splitBaitSuggestionByPlace),
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].headline).toBe("afternoon");
    expect(cards[0].matches).toHaveLength(1);
    expect(collapseBaitMatchesByPlace(morning).matches).toHaveLength(1);
  });

  it("keeps distinct bait places", () => {
    const cut = {
      id: "bait-cut",
      spotKey: "bait:28.735,-80.754",
      placeName: "Innertube cut",
      baitTypes: ["Shrimp"],
      latitude: 28.735,
      longitude: -80.754,
      window: windowOf({}),
      score: 40,
      strength: "strong" as const,
      headline: "cut",
      reasons: ["Same time of day"],
      matches: [
        {
          baitSpot: baitOf({ id: "cut", placeName: "Innertube cut" }),
          score: 40,
          reasons: ["Same time of day"],
          strength: "strong" as const,
        },
      ],
    };
    const point = {
      ...cut,
      id: "bait-point",
      placeName: "Ransom point",
      headline: "point",
      matches: [
        {
          baitSpot: baitOf({ id: "point", placeName: "Ransom point" }),
          score: 38,
          reasons: ["Same time of day"],
          strength: "strong" as const,
        },
      ],
    };
    expect(dedupeBaitSuggestionsByPlace([cut, point]).map((card) => card.placeName).sort()).toEqual([
      "Innertube cut",
      "Ransom point",
    ]);
  });

  it("dedupes Planned chips for the same bait place", () => {
    expect(
      uniqueNotesByPlace([
        { id: "a", placeName: "Haulover Canal" },
        { id: "b", placeName: "haulover  canal" },
        { id: "c", placeName: "Haulover Canal" },
      ]).map((note) => note.id),
    ).toEqual(["a"]);
  });
});

describe("planWhyChips", () => {
  it("keeps 1–3 scannable chips for a very-strong tide match", () => {
    expect(
      planWhyChips({
        reasons: ["same rising tide ~1.2 ft, ~6:42 AM", "Partly cloudy", "Within 2°F"],
        strength: "very-strong",
        placeName: "Galveston Bay, TX",
        species: "Redfish",
        timeOfDay: "dawn",
      }),
    ).toEqual([
      "Same rising tide ~1.2 ft, ~6:42 AM",
      "Partly cloudy skies",
      "Redfish at Galveston Bay",
    ]);
  });

  it("names the matching time of day when tides are not in the reasons", () => {
    expect(
      planWhyChips({
        reasons: ["Same time of day", "Cloudy", "Within 3°F"],
        strength: "strong",
        placeName: "Matagorda Bay, TX",
        species: "Speckled Trout",
        timeOfDay: "afternoon",
      }),
    ).toEqual(["Same afternoon", "Cloudy skies", "Speckled Trout at Matagorda Bay"]);
  });

  it("adds the forecast clock on a very-strong window", () => {
    const windowAt = "2026-08-02T11:42:00.000Z";
    const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
      new Date(windowAt),
    );
    const chips = planWhyChips({
      reasons: ["Same time of day", "Partly cloudy"],
      strength: "very-strong",
      placeName: "Galveston Bay, TX",
      species: "Redfish",
      timeOfDay: "morning",
      windowAt,
    });
    expect(chips[0]).toBe(`Around ${clock}`);
    expect(chips).toContain("Partly cloudy skies");
  });

  it("does not duplicate the clock when the tide reason already has it", () => {
    const windowAt = "2026-08-02T11:42:00.000Z";
    const clock = formatTimeOnly(windowAt);
    const chips = planWhyChips({
      reasons: [`same rising tide ~1.2 ft, ~${clock}`, "Partly cloudy"],
      strength: "very-strong",
      placeName: "Galveston Bay, TX",
      species: "Redfish",
      timeOfDay: "dawn",
      windowAt,
    });
    expect(chips.filter((chip) => chip.startsWith("Around "))).toEqual([]);
    expect(chips[0]).toContain(clock);
  });

  it("puts the forecast clock on the very-strong when line", () => {
    const windowAt = "2026-08-02T11:42:00.000Z";
    expect(forecastWindowWhenLabel(windowOf({ at: windowAt, timeOfDay: "morning" }), "very-strong")).toBe(
      `Morning · ${formatTimeOnly(windowAt)}`,
    );
    expect(forecastWindowWhenLabel(windowOf({ at: windowAt, timeOfDay: "morning" }), "strong")).toBe("Morning");
  });

  it("leaves lean and good matches as the raw reason list", () => {
    expect(
      planWhyChips({
        reasons: ["Same time of day", "Cloudy"],
        strength: "good",
        placeName: "Galveston Bay, TX",
        species: "Redfish",
        timeOfDay: "morning",
      }),
    ).toEqual(["Same time of day", "Cloudy"]);
  });
});

describe("parsePlanDate", () => {
  it("reads a local calendar day and rejects junk", () => {
    const date = parsePlanDate("2026-09-08");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(8);
    expect(date?.getDate()).toBe(8);
    expect(parsePlanDate("not-a-day")).toBeNull();
    expect(parsePlanDate("2026-13-40")).toBeNull();
    expect(parsePlanDate(null)).toBeNull();
  });
});

describe("last Plan day storage", () => {
  it("remembers a picked day so /plan without a date can reopen it", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    expect(readLastPlanDay(storage)).toBeNull();
    writeLastPlanDay("nope", storage);
    expect(store.size).toBe(0);
    writeLastPlanDay("2026-09-11", storage);
    expect(store.get(LAST_PLAN_DAY_STORAGE_KEY)).toBe("2026-09-11");
    expect(readLastPlanDay(storage)).toBe("2026-09-11");
    expect(readLastPlanDay(null)).toBeNull();
  });
});

describe("planLookupFailureNote", () => {
  it("stays quiet for empty or source notes", () => {
    expect(planLookupFailureNote("")).toBeNull();
    expect(planLookupFailureNote("   ")).toBeNull();
    expect(planLookupFailureNote("Pick a day to plan.")).toBeNull();
    expect(planLookupFailureNote("Demo forecast (no OpenWeather key). Patterned from season.")).toBeNull();
    expect(planLookupFailureNote("Upcoming conditions from OpenWeather 5-day forecast.")).toBeNull();
  });

  it("surfaces a short note only when a lookup actually failed", () => {
    expect(
      planLookupFailureNote("Weather or tide lookup failed for this day. Matches still use your log."),
    ).toBe("Weather or tide lookup failed for this day. Matches still use your log.");
    expect(
      planLookupFailureNote(
        "OpenWeather forecast failed — using demo forecast. Suggestions are still pattern matches.",
      ),
    ).toBe("Weather or tide lookup failed for this day. Matches still use your log.");
  });
});
