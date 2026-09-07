import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { addPlanSpotToDay } from "./notes";
import {
  PENDING_PLAN_BAIT_QUERY,
  PENDING_PLAN_CATCH_QUERY,
  PENDING_PLAN_DAY_STORAGE_KEY,
  PENDING_PLAN_PHOTO_QUERY,
  PENDING_PLAN_PLACE_QUERY,
  PENDING_PLAN_SPECIES_QUERY,
  PENDING_PLAN_SPOT_STORAGE_KEY,
  PENDING_PLAN_SPOT_TTL_MS,
  canShowAddToPlan,
  clearPendingPlanSpot,
  parsePendingPlanSpotSearch,
  pendingPlanDayToCommit,
  pendingPlanPrompt,
  pendingPlanSpotFromBait,
  pendingPlanSpotFromCatch,
  planHrefForPendingSpot,
  readPendingPlanDay,
  readPendingPlanSpot,
  resolvePendingPlanSpot,
  writePendingPlanDay,
  writePendingPlanSpot,
} from "./pending-plan-spot";
import { baitOf, catchOf } from "./testing";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("pendingPlanSpotFromCatch", () => {
  it("builds a place payload from a journal catch", () => {
    const record = catchOf({
      id: "c1",
      placeName: "  Innertube cut  ",
      species: "Redfish",
      speciesList: ["Redfish", "Speckled Trout"],
    });
    expect(pendingPlanSpotFromCatch(record)).toEqual({
      catchId: "c1",
      placeName: "Innertube cut",
      speciesTargets: ["Redfish", "Speckled Trout"],
    });
    expect(
      pendingPlanSpotFromCatch(catchOf({ id: "c-photo", placeName: "The point", photoPath: "redfish.jpg" })),
    ).toMatchObject({
      catchId: "c-photo",
      photoPath: "redfish.jpg",
    });
  });

  it("returns null when the catch has no place", () => {
    expect(pendingPlanSpotFromCatch(catchOf({ id: "c2", placeName: "   " }))).toBeNull();
    expect(pendingPlanSpotFromCatch({ id: "c3", placeName: null, species: "Redfish" })).toBeNull();
  });

  it("builds a place payload from a bait hole", () => {
    expect(pendingPlanSpotFromBait(baitOf({ id: "b1", placeName: "  Haulover Canal  " }))).toEqual({
      baitId: "b1",
      placeName: "Haulover Canal",
      speciesTargets: [],
    });
    expect(
      pendingPlanSpotFromBait(baitOf({ id: "b-photo", placeName: "Haulover Canal", photoPath: "shrimp.jpg" })),
    ).toMatchObject({
      baitId: "b-photo",
      photoPath: "shrimp.jpg",
    });
    expect(pendingPlanSpotFromBait({ id: "b2", placeName: "  " })).toBeNull();
  });
});

describe("plan href and query contract", () => {
  it("sends the catch id on /plan so the user still picks the day", () => {
    const href = planHrefForPendingSpot({
      catchId: "c1",
      placeName: "Innertube cut",
      speciesTargets: ["Redfish"],
    });
    const params = new URLSearchParams(href.slice("/plan?".length));
    expect(params.get(PENDING_PLAN_CATCH_QUERY)).toBe("c1");
    expect(params.get(PENDING_PLAN_PLACE_QUERY)).toBe("Innertube cut");
    expect(params.get(PENDING_PLAN_SPECIES_QUERY)).toBe("Redfish");
    expect(href).not.toMatch(/(^|[?&])date=/);
    const parsed = parsePendingPlanSpotSearch(params);
    expect(parsed).toEqual({
      catchId: "c1",
      placeName: "Innertube cut",
      speciesTargets: ["Redfish"],
    });
  });

  it("sends a bait id, place, and photo on /plan the same way", () => {
    const href = planHrefForPendingSpot({
      baitId: "b1",
      placeName: "Haulover Canal",
      speciesTargets: [],
      photoPath: "shrimp.jpg",
    });
    const params = new URLSearchParams(href.slice("/plan?".length));
    expect(params.get(PENDING_PLAN_BAIT_QUERY)).toBe("b1");
    expect(params.get(PENDING_PLAN_PLACE_QUERY)).toBe("Haulover Canal");
    expect(params.get(PENDING_PLAN_PHOTO_QUERY)).toBe("shrimp.jpg");
    expect(href).not.toMatch(/(^|[?&])date=/);
    expect(parsePendingPlanSpotSearch(params)).toEqual({
      baitId: "b1",
      placeName: "Haulover Canal",
      speciesTargets: [],
      photoPath: "shrimp.jpg",
    });
  });

  it("keeps the bait handoff on the URL when a day is picked", () => {
    const href = planHrefForPendingSpot(
      { baitId: "b1", placeName: "Haulover Canal", speciesTargets: [], photoPath: "shrimp.jpg" },
      "2026-09-12",
    );
    const params = new URLSearchParams(href.slice("/plan?".length));
    expect(params.get("date")).toBe("2026-09-12");
    expect(params.get(PENDING_PLAN_BAIT_QUERY)).toBe("b1");
    expect(params.get(PENDING_PLAN_PLACE_QUERY)).toBe("Haulover Canal");
  });

  it("falls back to a place query when there is no catch id", () => {
    const href = planHrefForPendingSpot({
      placeName: "Haulover Canal",
      speciesTargets: ["Redfish", "Snook"],
    });
    const params = new URLSearchParams(href.slice("/plan?".length));
    expect(params.get(PENDING_PLAN_PLACE_QUERY)).toBe("Haulover Canal");
    expect(params.get(PENDING_PLAN_SPECIES_QUERY)).toBe("Redfish,Snook");
    expect(parsePendingPlanSpotSearch(params)).toEqual({
      placeName: "Haulover Canal",
      speciesTargets: ["Redfish", "Snook"],
    });
  });
});

describe("session handoff", () => {
  it("round-trips a spot and expires a stale one", () => {
    const storage = memoryStorage();
    writePendingPlanSpot(storage, {
      catchId: "c1",
      placeName: "Farm Pond, OH",
      speciesTargets: ["Largemouth Bass"],
    });
    expect(readPendingPlanSpot(storage)?.placeName).toBe("Farm Pond, OH");
    const raw = JSON.parse(storage.getItem(PENDING_PLAN_SPOT_STORAGE_KEY) ?? "{}") as {
      savedAt: number;
    };
    expect(
      readPendingPlanSpot(storage, raw.savedAt + PENDING_PLAN_SPOT_TTL_MS + 1),
    ).toBeNull();
    clearPendingPlanSpot(storage);
    expect(readPendingPlanSpot(storage)).toBeNull();
  });

  it("lets the URL catch id win and fills place from session", () => {
    expect(
      resolvePendingPlanSpot(
        { catchId: "c1", placeName: "", speciesTargets: [] },
        { catchId: "c1", placeName: "Innertube cut", speciesTargets: ["Redfish"] },
      ),
    ).toEqual({
      catchId: "c1",
      placeName: "Innertube cut",
      speciesTargets: ["Redfish"],
    });
    expect(
      resolvePendingPlanSpot({ catchId: "other", placeName: "", speciesTargets: [] }, {
        catchId: "c1",
        placeName: "Innertube cut",
        speciesTargets: ["Redfish"],
      }),
    ).toEqual({ catchId: "other", placeName: "", speciesTargets: [] });
  });

  it("lets the URL bait id win and fills place from session", () => {
    expect(
      resolvePendingPlanSpot(
        { baitId: "b1", placeName: "", speciesTargets: [] },
        { baitId: "b1", placeName: "Haulover Canal", speciesTargets: [] },
      ),
    ).toEqual({
      baitId: "b1",
      placeName: "Haulover Canal",
      speciesTargets: [],
    });
    expect(
      resolvePendingPlanSpot({ baitId: "other", placeName: "", speciesTargets: [] }, {
        baitId: "b1",
        placeName: "Haulover Canal",
        speciesTargets: [],
      }),
    ).toEqual({ baitId: "other", placeName: "", speciesTargets: [] });
  });

  it("remembers the picked day across a Plan remount", () => {
    const storage = memoryStorage();
    writePendingPlanDay(storage, "2026-09-12");
    expect(readPendingPlanDay(storage)).toBe("2026-09-12");
    expect(storage.getItem(PENDING_PLAN_DAY_STORAGE_KEY)).toBe("2026-09-12");
    expect(
      pendingPlanDayToCommit(
        { baitId: "b1", placeName: "Haulover Canal", speciesTargets: [] },
        "2026-09-12",
        null,
      ),
    ).toBe("2026-09-12");
    expect(
      pendingPlanDayToCommit(null, "2026-09-12", "2026-09-12"),
    ).toBe("2026-09-12");
    expect(pendingPlanDayToCommit(null, "2026-09-12", null)).toBeNull();
    clearPendingPlanSpot(storage);
    expect(readPendingPlanDay(storage)).toBeNull();
  });
});

describe("Add to plan visibility", () => {
  it("is only for the viewer’s own named catch", () => {
    const mine = catchOf({ id: "mine", anglerId: "you", placeName: "The point" });
    const theirs = catchOf({ id: "theirs", anglerId: "friend", placeName: "The point" });
    expect(canShowAddToPlan(mine, "you", true)).toBe(true);
    expect(canShowAddToPlan(theirs, "you", true)).toBe(false);
    expect(canShowAddToPlan(mine, "you", false)).toBe(false);
    expect(canShowAddToPlan(mine, undefined, true)).toBe(false);
    expect(canShowAddToPlan(catchOf({ id: "no-place", placeName: null }), "you", true)).toBe(false);
    expect(
      canShowAddToPlan(
        baitOf({ id: "b1", anglerId: "you", placeName: "Haulover Canal", photoPath: null }),
        "you",
        true,
      ),
    ).toBe(true);
    expect(canShowAddToPlan(baitOf({ id: "b2", anglerId: "friend", placeName: "Haulover Canal" }), "you", true)).toBe(
      false,
    );
  });
});

describe("pending prompt", () => {
  it("asks the angler to pick a day", () => {
    expect(pendingPlanPrompt({ placeName: "Innertube cut", speciesTargets: [] })).toBe(
      "Pick a day to add Innertube cut.",
    );
    expect(pendingPlanPrompt({ catchId: "c1", placeName: "", speciesTargets: [] })).toBe(
      "Looking up that spot…",
    );
    expect(pendingPlanPrompt(null)).toBeNull();
  });
});

describe("pending spot uses the same Plan add path", () => {
  it("feeds addPlanSpotToDay once a day is chosen", () => {
    const pending = pendingPlanSpotFromCatch(
      catchOf({ id: "c1", placeName: "Innertube cut", speciesList: ["Redfish"] }),
    );
    expect(addPlanSpotToDay([], "2026-09-12", pending!)).toEqual({
      day: "2026-09-12",
      title: null,
      notes: null,
      placeName: "Innertube cut",
      speciesTargets: ["Redfish"],
      kind: "plan-spot",
      sourceCatchId: "c1",
    });
    const baitPending = pendingPlanSpotFromBait(baitOf({ id: "b1", placeName: "Haulover Canal" }));
    expect(addPlanSpotToDay([], "2026-09-12", baitPending!)).toEqual({
      day: "2026-09-12",
      title: null,
      notes: null,
      placeName: "Haulover Canal",
      speciesTargets: [],
      kind: "plan-spot",
      sourceBaitId: "b1",
    });
    expect(
      addPlanSpotToDay(
        [],
        "2026-09-12",
        pendingPlanSpotFromCatch(
          catchOf({ id: "c2", placeName: "Shamrock", speciesList: ["Redfish"], photoPath: "sham.jpg" }),
        )!,
      ),
    ).toEqual({
      day: "2026-09-12",
      title: null,
      notes: null,
      placeName: "Shamrock",
      speciesTargets: ["Redfish"],
      kind: "plan-spot",
      sourceCatchId: "c2",
      photoPath: "sham.jpg",
    });
  });
});

describe("Calendar Log and Plan wiring", () => {
  it("puts Add to plan on Calendar Log catch cards and not on Shared", () => {
    const catchCard = readFileSync(resolve(__dirname, "../components/CatchCard.tsx"), "utf8");
    const baitCard = readFileSync(resolve(__dirname, "../components/BaitSpotCard.tsx"), "utf8");
    const addBtn = readFileSync(resolve(__dirname, "../components/AddToPlanButton.tsx"), "utf8");
    const history = readFileSync(resolve(__dirname, "../components/HistoryClient.tsx"), "utf8");
    const calendar = readFileSync(resolve(__dirname, "../components/HistoryCalendar.tsx"), "utf8");
    const similar = readFileSync(resolve(__dirname, "../components/SimilarList.tsx"), "utf8");
    expect(addBtn).toContain('data-testid="add-to-plan"');
    expect(addBtn).toContain("Add to plan");
    expect(addBtn).toContain("writePendingPlanSpot");
    expect(addBtn).toContain("rounded-full bg-teal");
    expect(catchCard).toContain("AddToPlanButton");
    expect(catchCard).toContain("CatchStampChips");
    expect(catchCard).toContain("canShowAddToPlan");
    expect(catchCard).toContain("habitatLabel(record.habitat)");
    expect(catchCard).toMatch(/flex flex-wrap items-center gap-1[\s\S]*AddToPlanButton/);
    expect(catchCard).toContain('data-testid="add-to-plan-photo-chips"');
    expect(catchCard).toContain("overflow-visible");
    expect(catchCard).not.toContain("absolute inset-x-2 bottom-2");
    expect(catchCard).not.toContain("from-ink/70");
    expect(catchCard).toMatch(
      /habitatLabel\(record\.habitat\)[\s\S]*TIME_OF_DAY_LABELS[\s\S]*AddToPlanButton/,
    );
    expect(catchCard).not.toContain("flex justify-end px-3 pb-2");
    expect(catchCard).not.toContain("px-2.5 pb-2");
    expect(baitCard).toContain("AddToPlanButton");
    expect(baitCard).toContain("BaitStampChips");
    expect(baitCard).toContain("canShowAddToPlan");
    expect(baitCard).toContain("personalPhotoSrc(spot.photoPath)");
    expect(baitCard).toContain('data-testid="add-to-plan-photo-chips"');
    expect(baitCard).not.toContain("from-ink/70");
    expect(baitCard).toContain("overflow-visible");
    expect(baitCard).toContain("!src && addToPlan");
    expect(baitCard).not.toContain("uppercase tracking-wide text-copper");
    expect(history).toContain("showAddToPlan");
    expect(history).toContain("calendar-log-own-feed");
    const ownFeed = history.slice(history.lastIndexOf("calendar-log-own-feed") - 80);
    expect(ownFeed).toContain("showAddToPlan");
    const sharedIdx = history.indexOf("calendar-log-shared-feed");
    const sharedBlock = history.slice(sharedIdx - 160, sharedIdx + 40);
    expect(sharedBlock).not.toContain("showAddToPlan");
    expect(calendar).toContain("showAddToPlan");
    expect(calendar).toContain('data-testid="calendar-day-detail"');
    expect(calendar).toContain("overflow-visible");
    expect(similar).not.toContain("showAddToPlan");
    const baitDetail = readFileSync(resolve(__dirname, "../components/BaitSpotDetail.tsx"), "utf8");
    const spots = readFileSync(resolve(__dirname, "../components/SpotsClient.tsx"), "utf8");
    expect(baitDetail).toContain("AddToPlanButton");
    expect(baitDetail).not.toContain("rounded-full bg-copper/15");
    expect(spots).toContain("AddToPlanButton");
    expect(spots).toContain("pendingFromOwnBait");
    expect(spots).toContain("pendingPlanSpotFromBait");
    expect(spots).toMatch(/kind === "bait"[\s\S]*AddToPlanButton/);
    expect(spots).not.toContain("visitPending");
  });

  it("lets Plan wait for a day tap, then add the pending spot", () => {
    const plan = readFileSync(resolve(__dirname, "../components/PlanClient.tsx"), "utf8");
    const page = readFileSync(resolve(__dirname, "../app/plan/page.tsx"), "utf8");
    expect(plan).toContain("resolvePendingPlanSpot");
    expect(plan).toContain("addPlanSpotToDay");
    expect(plan).toContain("pendingPlanPrompt");
    expect(plan).toContain('data-testid="plan-pending-spot"');
    expect(plan).toContain("commitPendingSpot");
    expect(plan).toContain("onSelectDay");
    expect(plan).toContain("void commitPendingSpot(date)");
    expect(plan).toContain("planHrefForPendingSpot(pending, date)");
    expect(plan).toContain("pendingPlanDayToCommit");
    expect(plan).toContain("/api/catches/");
    expect(plan).toContain("/api/bait-spots/");
    expect(plan).toContain("pendingPlanSpotFromBait");
    expect(plan).toContain("dedupeBaitSuggestionsByPlace");
    expect(plan).toContain("dedupeCatchSuggestionsByPlace");
    expect(plan).toContain("extraPastTripMatches");
    expect(plan).toContain("uniqueNotesByPlace");
    expect(plan).not.toContain("setSelectedDay(pending");
    expect(page).toContain("addCatch");
    expect(page).toContain("addBait");
    expect(page).toContain("addPhoto");
    expect(page).toContain("initialAddCatch");
    expect(page).toContain("initialAddBait");
    expect(page).toContain("initialAddPhoto");
    expect(page).toContain("hasPendingAdd");
    expect(plan).toContain("if (pendingSpot) return");
    expect(plan).toContain("if (current || pendingSpot) return current");
  });
});
