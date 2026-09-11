import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addPlanSpotToDay,
  calendarDayHasPlan,
  calendarNoteHasContent,
  dayHasPlanSpot,
  groupNotesByDay,
  expiredPlanNotes,
  isExpiredPlanDay,
  formatPlanCalendarLabel,
  journalNotesForCalendarLog,
  journalNotesForPlanWriteups,
  labelsByPlanDay,
  labelsForPlannedSpot,
  PLAN_CALENDAR_LABEL_MAX,
  PLAN_DAY_LABEL_MAX,
  planDayLabel,
  planDayLabelInput,
  planDayLabelNote,
  noteHeadline,
  parseCalendarNoteInput,
  plannedSpotOpenLabel,
  parseDayKey,
  parseSpeciesTargets,
  planDayPurgeBeforeKey,
  planHrefForDay,
  planNoteInput,
  planNotesOnDay,
  planSpotNoteInput,
  plannedSpotsOnDay,
  listedPlanNotes,
  isPlausiblePlanToday,
  mergeCommittedPlanSpots,
  mergeListedPlanNotes,
  mergePlannedPlacePhotos,
  photosForPlannedPlaces,
  planSpotDetailHref,
  planDayAfterSelect,
  planSpotSourceKind,
  restorePlanDay,
  safePlanDayPurgeBeforeKey,
  selectPlanDay,
  shiftDayKey,
  upcomingPlanNotes,
} from "./notes";
import type { CalendarNote } from "./types";

function note(partial: Partial<CalendarNote>): CalendarNote {
  return {
    id: "n1",
    anglerId: "a1",
    day: "2026-09-10",
    title: null,
    notes: null,
    placeName: null,
    speciesTargets: [],
    kind: "journal",
    sourceCatchId: null,
    sourceBaitId: null,
    photoPath: null,
    createdAt: "2026-09-02T12:00:00.000Z",
    updatedAt: "2026-09-02T12:00:00.000Z",
    ...partial,
  };
}

describe("parseCalendarNoteInput", () => {
  it("requires a YYYY-MM-DD day and some content", () => {
    expect(parseCalendarNoteInput({ day: "nope", title: "Dawn flood" })).toBeNull();
    expect(parseCalendarNoteInput({ day: "2026-09-10" })).toBeNull();
    expect(parseCalendarNoteInput({ day: "2026-09-10", title: "  " })).toBeNull();
  });

  it("keeps title, notes, place, and unique species", () => {
    const parsed = parseCalendarNoteInput({
      day: "2026-09-10",
      title: "  Dawn flood  ",
      notes: "Outgoing at the point.",
      placeName: "Mosquito Lagoon",
      speciesTargets: ["Redfish", "redfish", " Snook ", ""],
    });
    expect(parsed).toEqual({
      day: "2026-09-10",
      title: "Dawn flood",
      notes: "Outgoing at the point.",
      placeName: "Mosquito Lagoon",
      speciesTargets: ["Redfish", "Snook"],
      kind: "journal",
    });
  });

  it("accepts species-only notes", () => {
    expect(calendarNoteHasContent({ speciesTargets: ["Redfish"] })).toBe(true);
    expect(parseSpeciesTargets(["Redfish", "Redfish", 3])).toEqual(["Redfish"]);
  });
});

describe("planNoteInput", () => {
  it("saves notes-only text for a new plan day", () => {
    expect(planNoteInput("2026-09-10", "  Try the north shoreline.  ")).toEqual({
      day: "2026-09-10",
      notes: "Try the north shoreline.",
      title: null,
      placeName: null,
      speciesTargets: [],
      kind: "journal",
    });
    expect(calendarNoteHasContent(planNoteInput("2026-09-10", "Try the north shoreline."))).toBe(
      true,
    );
  });

  it("keeps Calendar Log title, place, and species when editing notes", () => {
    const patched = planNoteInput("2026-09-10", "Outgoing at the point.", {
      title: "Dawn flood",
      placeName: "Mosquito Lagoon",
      speciesTargets: ["Redfish"],
    });
    expect(patched).toEqual({
      day: "2026-09-10",
      notes: "Outgoing at the point.",
      title: "Dawn flood",
      placeName: "Mosquito Lagoon",
      speciesTargets: ["Redfish"],
      kind: "journal",
    });
  });
});

describe("planSpotNoteInput", () => {
  it("saves a suggested spot onto that calendar day", () => {
    const input = planSpotNoteInput("2026-09-10", {
      placeName: "  Mosquito Lagoon, FL  ",
      speciesTargets: ["Redfish", "redfish", "Snook"],
    });
    expect(input).toEqual({
      day: "2026-09-10",
      title: null,
      notes: null,
      placeName: "Mosquito Lagoon, FL",
      speciesTargets: ["Redfish", "Snook"],
      kind: "plan-spot",
    });
    expect(calendarNoteHasContent(input!)).toBe(true);
    expect(parseCalendarNoteInput(input!)).toEqual(input);
  });

  it("rejects a missing day or place", () => {
    expect(planSpotNoteInput("not-a-day", { placeName: "Haulover Canal" })).toBeNull();
    expect(planSpotNoteInput("2026-09-10", { placeName: "   " })).toBeNull();
    expect(planSpotNoteInput("2026-09-10", { placeName: null })).toBeNull();
  });
});

describe("dayHasPlanSpot", () => {
  it("treats a matching Plan-day place as already added", () => {
    const notes = [note({ placeName: "Mosquito Lagoon, FL", kind: "plan-spot" })];
    expect(dayHasPlanSpot(notes, "mosquito lagoon, fl")).toBe(true);
    expect(dayHasPlanSpot(notes, "Haulover Canal")).toBe(false);
    expect(dayHasPlanSpot([note({ placeName: "Mosquito Lagoon, FL" })], "mosquito lagoon, fl")).toBe(
      false,
    );
    expect(dayHasPlanSpot([], "Mosquito Lagoon, FL")).toBe(false);
  });

  it("lists Plan-day spots, not Calendar Log planned trips", () => {
    const spot = note({
      id: "s",
      placeName: "Haulover Canal",
      speciesTargets: ["Redfish"],
      kind: "plan-spot",
    });
    const writeup = note({ id: "w", notes: "Wind east 10." });
    const journalPlace = note({ id: "j", placeName: "Farm Pond", kind: "journal" });
    expect(plannedSpotsOnDay([spot, writeup, journalPlace]).map((n) => n.placeName)).toEqual([
      "Haulover Canal",
    ]);
    expect(calendarDayHasPlan([spot, writeup, journalPlace])).toBe(true);
    expect(calendarDayHasPlan([writeup, journalPlace])).toBe(false);
    expect(planHrefForDay("2026-09-09")).toBe("/plan?date=2026-09-09");
    expect(journalNotesForCalendarLog([spot, writeup, journalPlace]).map((n) => n.id)).toEqual([
      "w",
      "j",
    ]);
  });

  it("adds a suggested spot once, then skips a second tap", () => {
    const first = addPlanSpotToDay([], "2026-09-10", {
      placeName: "Haulover Canal",
      speciesTargets: ["Redfish"],
    });
    expect(first).toEqual({
      day: "2026-09-10",
      title: null,
      notes: null,
      placeName: "Haulover Canal",
      speciesTargets: ["Redfish"],
      kind: "plan-spot",
    });
    const afterAdd = [note({ placeName: first!.placeName, kind: "plan-spot" })];
    expect(dayHasPlanSpot(afterAdd, "Haulover Canal")).toBe(true);
    expect(addPlanSpotToDay(afterAdd, "2026-09-10", { placeName: "haulover canal" })).toBeNull();
    expect(
      addPlanSpotToDay(afterAdd, "2026-09-10", { placeName: "Mosquito Lagoon" })?.placeName,
    ).toBe("Mosquito Lagoon");
    expect(
      addPlanSpotToDay([], "2026-10-11", {
        placeName: "Haulover Canal",
        speciesTargets: ["Redfish"],
        catchId: "c1",
      }),
    ).toMatchObject({
      day: "2026-10-11",
      placeName: "Haulover Canal",
      sourceCatchId: "c1",
    });
  });

  it("still adds bait when a catch is already planned at that place", () => {
    const catchSpot = note({
      placeName: "Haulover Canal",
      kind: "plan-spot",
      sourceCatchId: "c1",
    });
    expect(dayHasPlanSpot([catchSpot], "Haulover Canal", { baitId: "b1" })).toBe(false);
    expect(dayHasPlanSpot([catchSpot], "Haulover Canal", { catchId: "c2" })).toBe(true);
    expect(
      addPlanSpotToDay([catchSpot], "2026-09-10", {
        placeName: "Haulover Canal",
        baitId: "b1",
        photoPath: "shrimp.jpg",
      }),
    ).toEqual({
      day: "2026-09-10",
      title: null,
      notes: null,
      placeName: "Haulover Canal",
      speciesTargets: [],
      kind: "plan-spot",
      sourceBaitId: "b1",
      photoPath: "shrimp.jpg",
    });
    expect(planSpotSourceKind({ baitId: "b1" })).toBe("bait");
    expect(planSpotSourceKind({ sourceCatchId: "c1" })).toBe("catch");
    expect(planSpotDetailHref({ sourceBaitId: "b1" })).toBe("/bait/b1");
    expect(planSpotDetailHref({ baitId: "b1" })).toBe("/bait/b1");
    expect(planSpotDetailHref({ sourceBaitId: "b1", photoPath: null })).toBe("/bait/b1");
    expect(planSpotDetailHref({ sourceCatchId: "c1" })).toBe("/catch/c1");
    expect(planSpotDetailHref({ catchId: "c1" })).toBe("/catch/c1");
    expect(
      planSpotDetailHref({ sourceBaitId: "b1" }, { href: "/catch/wrong" }),
    ).toBe("/bait/b1");
    expect(planSpotDetailHref({ placeName: "Haulover Canal" })).toBeNull();
    expect(
      planSpotDetailHref({ placeName: "Haulover Canal" }, { href: "/catch/c1" }),
    ).toBe("/catch/c1");
  });

  it("labels Planned rows with fish and bait from the note or source journal", () => {
    const catchSpot = note({
      placeName: "Innertube cut",
      kind: "plan-spot",
      sourceCatchId: "c1",
      speciesTargets: ["Redfish"],
    });
    expect(labelsForPlannedSpot(catchSpot)).toEqual({ fish: ["Redfish"], bait: [] });
    expect(
      labelsForPlannedSpot(catchSpot, {
        catches: [{ id: "c1", species: "Speckled Trout", speciesList: ["Speckled Trout"], bait: "Shrimp" }],
      }),
    ).toEqual({ fish: ["Redfish"], bait: ["Shrimp"] });
    expect(
      labelsForPlannedSpot(note({ placeName: "Innertube cut", kind: "plan-spot", sourceCatchId: "c1" }), {
        catches: [
          {
            id: "c1",
            species: "Speckled Trout",
            speciesList: ["Speckled Trout", "Redfish"],
            bait: "Cut bait",
          },
        ],
      }),
    ).toEqual({ fish: ["Speckled Trout", "Redfish"], bait: ["Cut bait"] });
    expect(
      labelsForPlannedSpot(
        note({
          placeName: "Aransas Pass, Texas",
          kind: "plan-spot",
          sourceBaitId: "b1",
        }),
        { baitSpots: [{ id: "b1", baitTypes: ["Shrimp", "Croaker"] }] },
      ),
    ).toEqual({ fish: [], bait: ["Shrimp", "Croaker"] });
    expect(
      labelsForPlannedSpot(
        note({
          placeName: "Aransas Pass, Texas",
          kind: "plan-spot",
          sourceBaitId: "b1",
          speciesTargets: ["Finger mullet"],
        }),
      ),
    ).toEqual({ fish: [], bait: ["Finger mullet"] });
    expect(
      labelsForPlannedSpot(note({ placeName: "Shamrock", kind: "plan-spot", sourceCatchId: "c-empty" }), {
        catches: [{ id: "c-empty", species: "Unknown", speciesList: [], bait: null }],
      }),
    ).toEqual({ fish: [], bait: [] });
    expect(labelsForPlannedSpot(note({ placeName: "Shamrock", kind: "plan-spot" }))).toEqual({
      fish: [],
      bait: [],
    });
    expect(plannedSpotOpenLabel("Innertube cut", "catch", { fish: ["Redfish"], bait: ["Cut bait"] })).toBe(
      "Innertube cut Redfish Cut bait catch",
    );
    expect(plannedSpotOpenLabel("Aransas Pass, Texas", "bait", { fish: [], bait: ["Shrimp"] })).toBe(
      "Aransas Pass, Texas Shrimp bait",
    );
  });

  it("keeps Plan-day adds out of Calendar Log Planned trips", () => {
    const planSpot = note({
      id: "s",
      placeName: "Haulover Canal",
      speciesTargets: ["Redfish"],
      kind: "plan-spot",
    });
    const plannedTrip = note({ id: "t", title: "Dawn flood", placeName: "The point" });
    expect(journalNotesForCalendarLog([planSpot, plannedTrip]).map((n) => n.id)).toEqual(["t"]);
    expect(journalNotesForCalendarLog([planSpot])).toEqual([]);
    expect(plannedSpotsOnDay([planSpot, plannedTrip]).map((n) => n.placeName)).toEqual([
      "Haulover Canal",
    ]);
  });
});

describe("groupNotesByDay", () => {
  it("groups and orders by created time", () => {
    const later = note({ id: "b", createdAt: "2026-09-02T13:00:00.000Z", title: "Second" });
    const earlier = note({ id: "a", createdAt: "2026-09-02T12:00:00.000Z", title: "First" });
    const other = note({ id: "c", day: "2026-09-11", title: "Next" });
    const groups = groupNotesByDay([later, other, earlier]);
    expect(groups.get("2026-09-10")?.map((n) => n.id)).toEqual(["a", "b"]);
    expect(groups.get("2026-09-11")?.map((n) => n.id)).toEqual(["c"]);
  });
});

describe("Plan add-to-day UI", () => {
  it("wires Add on suggested spots into the selected calendar day", () => {
    const plan = readFileSync(resolve(__dirname, "../components/PlanClient.tsx"), "utf8");
    expect(plan).toContain("addPlanSpotToDay");
    expect(plan).toContain("dayHasPlanSpot");
    expect(plan).toContain("planPlaceToAdd");
    expect(plan).toContain("splitPlanSuggestionByPlace");
    expect(plan).toContain("splitBaitSuggestionByPlace");
    expect(plan).toContain("dedupeBaitSuggestionsByPlace");
    expect(plan).toContain("dedupeCatchSuggestionsByPlace");
    expect(plan).toContain("extraPastTripMatches");
    expect(plan).toContain("uniqueNotesByPlace");
    expect(plan).toContain("mergeCommittedPlanSpots");
    expect(plan).toContain("rememberCommittedPlanSpot");
    expect(plan).toContain("/api/calendar-notes?for=plan&today=");
    expect(plan).toContain("listedPlanNotes");
    expect(plan).toContain("mergeListedPlanNotes");
    expect(plan).toContain("mergePlannedPlacePhotos");
    expect(plan).toContain("photosForPlannedPlaces");
    expect(plan).toContain("planSpotDetailHref");
    expect(plan).toContain("labelsForPlannedSpot");
    expect(plan).toContain("plannedSpotOpenLabel");
    expect(plan).toContain('data-testid="plan-day-spot-open"');
    expect(plan).toContain('data-testid="plan-day-spot-fish"');
    expect(plan).toContain('data-testid="plan-day-spot-bait"');
    expect(plan).toContain("sourceCatchId");
    expect(plan).toContain("sourceBaitId");
    expect(plan).toContain("restorePlanDay");
    expect(plan).toContain("planDayAfterSelect");
    expect(plan).toContain("selectPlanDay");
    expect(plan).toContain("readLastPlanDay");
    expect(plan).toContain("writeLastPlanDay");
    expect(plan).toContain("data-no-tab-swipe");
    expect(plan).toContain('type="button"');
    expect(plan).toContain("onClick={() => onSelectDay(cell.date)}");
    expect(plan).not.toContain("planHrefForPendingSpot(pendingSpot, cell.date)");
    expect(plan).toContain("r.ok ? r.json() : null");
    expect(plan).toContain("onDeletePlan");
    const planPage = readFileSync(resolve(__dirname, "../app/plan/page.tsx"), "utf8");
    expect(planPage).toContain("restorePlanDay");
    expect(planPage).toContain("listCalendarNotes(viewer.id, { forPlan: true })");
    expect(planPage).not.toContain("today:");
    expect(plan).toContain('confirm("Delete this plan?")');
    expect(plan).toContain("/api/calendar-notes?day=");
    expect(plan).toContain('data-testid="plan-delete-day"');
    expect(plan).toContain("Delete plan");
    expect(plan).toContain("journalNotesForCalendarLog");
    expect(plan).toContain("journalNotesForPlanWriteups");
    expect(plan).toContain("PlanDayLabel");
    expect(plan).toContain("PlanDayNotes");
    expect(plan).toContain("labelsByPlanDay");
    expect(plan).toContain("formatPlanCalendarLabel");
    expect(plan).toContain("planDayLabel");
    expect(plan).toContain('data-testid="plan-day-label"');
    expect(plan.indexOf('data-testid="plan-planned"')).toBeLessThan(plan.indexOf("<PlanDayNotes"));
    expect(plan.indexOf("<PlanDayLabel")).toBeLessThan(plan.indexOf("<PlanDayNotes"));
    const planNotes = readFileSync(resolve(__dirname, "../components/CalendarNotes.tsx"), "utf8");
    expect(planNotes).toContain('data-testid="plan-day-notes"');
    expect(planNotes).toContain('data-testid="plan-day-note"');
    expect(planNotes).toContain('data-testid="plan-day-label-field"');
    expect(planNotes).toContain('data-testid="plan-day-label-input"');
    expect(planNotes).toContain('data-testid="plan-day-label-save"');
    expect(planNotes).toContain("planDayLabelInput");
    expect(plan).toContain('data-testid="plan-add-spot"');
    expect(plan).toContain("data-place-name");
    const calendar = readFileSync(resolve(__dirname, "../components/HistoryClient.tsx"), "utf8");
    expect(calendar).toContain("include=plan-spots");
    expect(calendar).toContain("calendarDayHasPlan");
    expect(calendar).toContain("planHrefForDay");
    expect(calendar).toContain("router.replace(planHrefForDay(selectedDay))");
    expect(calendar).not.toContain("journalNotesForCalendarLog");
    expect(calendar).not.toContain("for=plan");
    const calendarGrid = readFileSync(resolve(__dirname, "../components/HistoryCalendar.tsx"), "utf8");
    expect(calendarGrid).toContain("calendarDayHasPlan");
    expect(calendarGrid).toContain("planHrefForDay");
    expect(calendarGrid).toContain("Planned");
    expect(calendarGrid).toContain('data-testid="calendar-day-planned"');
    expect(calendarGrid).not.toContain('data-testid="plan-day-label"');
    const calendarPage = readFileSync(resolve(__dirname, "../app/calendar/page.tsx"), "utf8");
    expect(calendarPage).toContain("includePlanSpots: true");
    expect(plan).toContain('data-testid="plan-suggested-spots"');
    expect(plan).toContain('data-testid="plan-day-spots"');
    expect(plan).toContain('data-testid="plan-planned"');
    expect(plan).toContain('data-testid="plan-planned-photos"');
    expect(plan).toContain("/api/catches");
    expect(plan).toContain("/api/bait-spots");
    expect(plan).toContain("journalCatches");
    expect(plan).toContain("border-teal bg-card");
    expect(plan).not.toContain("ring-inset");
    expect(plan).toContain("overflow-visible");
    expect(plan.indexOf("<PlanDayCalendar")).toBeLessThan(plan.indexOf('data-testid="plan-planned"'));
    expect(plan.indexOf('data-testid="plan-planned"')).toBeLessThan(
      plan.indexOf('data-testid="plan-suggested-spots"'),
    );
    expect(plan).toMatch(/<h3 className="font-display text-xl text-teal">Planned<\/h3>/);
    expect(plan).not.toMatch(/<(h[1-6])[^>]*>[^<]*(On this day|everything planned|planned for)/i);
    expect(plan).not.toContain("On this day");
    expect(plan).not.toContain("everything planned");
    expect(plan).not.toContain("planned for this day");
    expect(plan).toContain("Tap Add on a place to put");
    expect(plan).toContain("only that one place");
    const notesApi = readFileSync(resolve(__dirname, "../app/api/calendar-notes/route.ts"), "utf8");
    expect(notesApi).toContain('searchParams.get("include") === "plan-spots"');
    expect(notesApi).toContain("parseDayKey(request.nextUrl.searchParams.get(\"today\"))");
    expect(notesApi).toContain("serverToday: utcTodayKey()");
    expect(notesApi).toContain("deleteCalendarNotesForDay");
    expect(notesApi).toContain("export async function DELETE");
    expect(calendar).not.toContain("today=");
    expect(calendar).not.toContain("Delete plan");
    expect(plan).toContain("Past trips at this place");
    expect(plan).toContain("{added ? \"Added\" : adding ? \"Adding…\" : \"Add\"}");
    expect(plan).not.toContain("Show spot on map");
    expect(plan).not.toContain("plan-show-spot-map");
    expect(plan).not.toContain("SaveToPhotosButton");
    expect(plan).not.toContain("Save to Photos");
    expect(plan).not.toContain("matches.flatMap");
    expect(plan).not.toContain("matches.map((m) => void onAddSpot");
    expect(plan).toContain("commitPendingSpot");
    expect(plan).toContain('data-testid="plan-pending-spot"');
    expect(plan).toContain("planHrefForPendingSpot(pending, picked.day)");
    expect(plan).toContain("void commitPendingSpot(picked.day)");
    expect(plan).toContain('window.history.replaceState(null, "", `/plan?date=${day}`)');
    expect(plan).toContain("/api/bait-spots/");
    expect(plan).toContain("pendingPlanSpotFromBait");
  });

  it("adds one place from a same-spot card that lists several past trips", () => {
    const input = addPlanSpotToDay([], "2026-09-10", {
      placeName: "Innertube cut",
      speciesTargets: ["Redfish", "Speckled Trout", "Redfish"],
    });
    expect(input).toEqual({
      day: "2026-09-10",
      title: null,
      notes: null,
      placeName: "Innertube cut",
      speciesTargets: ["Redfish", "Speckled Trout"],
      kind: "plan-spot",
    });
    const after = [note({ placeName: "Innertube cut", kind: "plan-spot" })];
    expect(addPlanSpotToDay(after, "2026-09-10", { placeName: "Innertube cut" })).toBeNull();
    expect(addPlanSpotToDay(after, "2026-09-10", { placeName: "Ransom point" })?.placeName).toBe(
      "Ransom point",
    );
    expect(addPlanSpotToDay(after, "2026-09-10", { placeName: "Harbor island" })?.placeName).toBe(
      "Harbor island",
    );
  });
});

describe("expired Plan days", () => {
  it("purges a Plan day only 3 local days after it, not the day after", () => {
    expect(shiftDayKey("2026-09-10", -2)).toBe("2026-09-08");
    expect(planDayPurgeBeforeKey("2026-09-10")).toBe("2026-09-08");
    expect(isExpiredPlanDay("2026-09-10", "2026-09-10")).toBe(false);
    expect(isExpiredPlanDay("2026-09-09", "2026-09-10")).toBe(false);
    expect(isExpiredPlanDay("2026-09-08", "2026-09-10")).toBe(false);
    expect(isExpiredPlanDay("2026-09-07", "2026-09-10")).toBe(true);
    expect(isExpiredPlanDay("2026-09-06", "2026-09-10")).toBe(true);
    expect(isExpiredPlanDay("2026-09-11", "2026-09-10")).toBe(false);
    expect(isExpiredPlanDay("2026-09-09", "2026-09-11")).toBe(false);
    expect(isExpiredPlanDay("2026-09-09", "2026-09-12")).toBe(true);
    expect(isExpiredPlanDay("nope", "2026-09-10")).toBe(false);
    expect(parseDayKey("2026-09-10")).toBe("2026-09-10");
    expect(parseDayKey(" 2026-09-10 ")).toBe("2026-09-10");
    expect(parseDayKey("09/10/2026")).toBeNull();
  });

  it("splits notes so only Plan days 3+ days old are purged", () => {
    const expiredSpot = note({
      id: "expired-spot",
      day: "2026-09-07",
      placeName: "Haulover Canal",
      kind: "plan-spot",
    });
    const expiredWriteup = note({
      id: "expired-note",
      day: "2026-09-06",
      notes: "Try the flood.",
    });
    const graceSpot = note({
      id: "grace-spot",
      day: "2026-09-08",
      placeName: "Farm Pond",
      kind: "plan-spot",
    });
    const yesterdayWriteup = note({
      id: "yesterday-note",
      day: "2026-09-09",
      notes: "Still on the board.",
    });
    const todaySpot = note({
      id: "today-spot",
      day: "2026-09-10",
      placeName: "The point",
      kind: "plan-spot",
    });
    const tomorrowWriteup = note({
      id: "future-note",
      day: "2026-09-11",
      notes: "Dawn outgoing.",
    });
    const all = [
      expiredSpot,
      expiredWriteup,
      graceSpot,
      yesterdayWriteup,
      todaySpot,
      tomorrowWriteup,
    ];
    expect(expiredPlanNotes(all, "2026-09-10").map((n) => n.id)).toEqual([
      "expired-spot",
      "expired-note",
    ]);
    expect(upcomingPlanNotes(all, "2026-09-10").map((n) => n.id)).toEqual([
      "grace-spot",
      "yesterday-note",
      "today-spot",
      "future-note",
    ]);
    expect(planNotesOnDay(all, "2026-09-10").map((n) => n.id)).toEqual(["today-spot"]);
  });

  it("keeps today's plan-spots through the Plan remount list/refetch path", () => {
    const today = "2026-09-10";
    const spot = note({
      id: "today-spot",
      day: today,
      placeName: "Haulover Canal",
      kind: "plan-spot",
    });
    const writeup = note({
      id: "today-note",
      day: today,
      notes: "Wind east 10.",
    });
    const grace = note({
      id: "grace-spot",
      day: "2026-09-08",
      placeName: "Farm Pond",
      kind: "plan-spot",
    });
    // SSR lists without today (no purge). Client refetch filters with local today.
    const ssr = [spot, writeup, grace];
    const afterRefetch = listedPlanNotes(ssr, today);
    expect(afterRefetch?.map((n) => n.id)).toEqual(["today-spot", "today-note", "grace-spot"]);
    expect(listedPlanNotes(undefined, today)).toBeNull();
    expect(listedPlanNotes(null, today)).toBeNull();
    expect(restorePlanDay(afterRefetch ?? [], today, null)).toBe(today);
    expect(restorePlanDay(afterRefetch ?? [], today, "2026-09-11")).toBe("2026-09-11");
    expect(plannedSpotsOnDay(planNotesOnDay(afterRefetch ?? [], today)).map((n) => n.placeName)).toEqual([
      "Haulover Canal",
    ]);
  });

  it("selects an empty calendar day so a new plan can start there", () => {
    const today = "2026-09-11";
    const planned = note({
      id: "oct10",
      day: "2026-10-10",
      placeName: "Beach marker 42",
      speciesTargets: ["Redfish"],
      kind: "plan-spot",
      notes: "Sharkathon",
    });
    expect(selectPlanDay("2026-10-11")).toBe("2026-10-11");
    expect(selectPlanDay("2026-10-10")).toBe("2026-10-10");
    expect(selectPlanDay("not-a-day")).toBeNull();
    expect(selectPlanDay(null)).toBeNull();
    const empty = planDayAfterSelect([planned], "2026-10-11");
    expect(empty).toEqual({ day: "2026-10-11", notes: [] });
    expect(empty?.day).not.toBe(planned.day);
    expect(addPlanSpotToDay(empty?.notes ?? [], empty!.day, { placeName: "The point" })).toEqual({
      day: "2026-10-11",
      title: null,
      notes: null,
      placeName: "The point",
      speciesTargets: [],
      kind: "plan-spot",
    });
    expect(planNoteInput(empty!.day, "Try the flood.")).toEqual({
      day: "2026-10-11",
      notes: "Try the flood.",
      title: null,
      placeName: null,
      speciesTargets: [],
      kind: "journal",
    });
    expect(restorePlanDay([planned], today, empty!.day)).toBe("2026-10-11");
    expect(restorePlanDay([planned], today, null)).toBe("2026-10-10");
    const existing = planDayAfterSelect([planned], "2026-10-10");
    expect(existing?.day).toBe("2026-10-10");
    expect(existing?.notes.map((n) => n.placeName)).toEqual(["Beach marker 42"]);
    expect(calendarDayHasPlan(existing?.notes ?? [])).toBe(true);
    expect(calendarDayHasPlan(empty?.notes ?? [])).toBe(false);
  });

  it("reopens the Planned panel on a day that still has notes when /plan has no date", () => {
    const today = "2026-09-10";
    const tomorrow = note({
      id: "t",
      day: "2026-09-11",
      placeName: "The point",
      kind: "plan-spot",
    });
    expect(restorePlanDay([], today, null)).toBeNull();
    expect(restorePlanDay([tomorrow], today, null)).toBe("2026-09-11");
    expect(restorePlanDay([tomorrow], today, "2026-09-07")).toBe("2026-09-11");
    expect(restorePlanDay([note({ day: "2026-09-09", notes: "Grace" })], today, null)).toBe(
      "2026-09-09",
    );
  });

  it("does not treat a selected future date or a 3-day-ahead clock as today", () => {
    expect(isPlausiblePlanToday("2026-09-10", "2026-09-10")).toBe(true);
    expect(isPlausiblePlanToday("2026-09-11", "2026-09-10")).toBe(true);
    expect(isPlausiblePlanToday("2026-09-09", "2026-09-10")).toBe(true);
    expect(isPlausiblePlanToday("2026-09-20", "2026-09-10")).toBe(false);
    expect(isPlausiblePlanToday("2026-09-07", "2026-09-10")).toBe(false);
    expect(safePlanDayPurgeBeforeKey("2026-09-10", "2026-09-10")).toBe("2026-09-08");
    expect(safePlanDayPurgeBeforeKey("2026-09-11", "2026-09-10")).toBe("2026-09-08");
    expect(safePlanDayPurgeBeforeKey("2026-09-20", "2026-09-10")).toBeNull();
    expect(isExpiredPlanDay("2026-09-10", "2026-09-10")).toBe(false);
    expect(isExpiredPlanDay("2026-09-08", "2026-09-10")).toBe(false);
  });

  it("keeps remount notes and Planned photo thumbs when the list comes back empty", () => {
    const today = "2026-09-10";
    const spot = note({
      id: "today-spot",
      day: today,
      placeName: "Haulover Canal",
      kind: "plan-spot",
    });
    const writeup = note({ id: "today-note", day: today, notes: "Wind east 10." });
    expect(mergeListedPlanNotes([spot, writeup], [], today).map((n) => n.id)).toEqual([
      "today-spot",
      "today-note",
    ]);
    expect(mergeListedPlanNotes([spot], [spot, writeup], today).map((n) => n.id)).toEqual([
      "today-spot",
      "today-note",
    ]);
    expect(mergeListedPlanNotes([spot], null, today).map((n) => n.id)).toEqual(["today-spot"]);
    const justAddedBait = note({
      id: "just-bait",
      day: today,
      placeName: "Haulover Canal",
      kind: "plan-spot",
      sourceBaitId: "b1",
      photoPath: "shrimp.jpg",
    });
    expect(
      mergeListedPlanNotes([spot, justAddedBait], [spot], today).map((n) => n.id),
    ).toEqual(["today-spot", "just-bait"]);
    expect(
      mergeCommittedPlanSpots([spot], [
        {
          day: today,
          placeName: "Haulover Canal",
          sourceBaitId: "b1",
          photoPath: "shrimp.jpg",
          savedAt: Date.parse("2026-09-10T12:00:00.000Z"),
        },
      ]).map((n) => ({ id: n.id, sourceBaitId: n.sourceBaitId, photoPath: n.photoPath })),
    ).toEqual([
      { id: "today-spot", sourceBaitId: null, photoPath: null },
      {
        id: "local:2026-09-10:bait:haulover canal",
        sourceBaitId: "b1",
        photoPath: "shrimp.jpg",
      },
    ]);
    expect(
      mergeCommittedPlanSpots([justAddedBait], [
        { day: today, placeName: "Haulover Canal", sourceBaitId: "b1" },
      ]).map((n) => n.id),
    ).toEqual(["just-bait"]);
    const cached = [
      {
        id: "today-spot",
        placeName: "Haulover Canal",
        src: "/api/media/haulover.jpg",
        href: "/catch/c1",
      },
    ];
    expect(mergePlannedPlacePhotos([spot], [], cached)).toEqual(cached);
    expect(mergePlannedPlacePhotos([], cached, cached)).toEqual([]);
  });

  it("shows the added catch or bait photo on Planned without waiting for suggestions", () => {
    const catchSpot = note({
      id: "from-catch",
      placeName: "Innertube cut",
      kind: "plan-spot",
      sourceCatchId: "c1",
      photoPath: "redfish.jpg",
    });
    expect(photosForPlannedPlaces([catchSpot])).toEqual([
      {
        id: "from-catch",
        placeName: "Innertube cut",
        src: "/api/media/redfish.jpg",
        href: "/catch/c1",
      },
    ]);
    const baitSpot = note({
      id: "from-bait",
      placeName: "Haulover Canal",
      kind: "plan-spot",
      sourceBaitId: "b1",
      photoPath: "shrimp.jpg",
    });
    expect(photosForPlannedPlaces([baitSpot])).toEqual([
      {
        id: "from-bait",
        placeName: "Haulover Canal",
        src: "/api/media/shrimp.jpg",
        href: "/bait/b1",
      },
    ]);
  });

  it("fills one Planned photo per added place from the journal when the note has no photoPath", () => {
    const portland = note({
      id: "p1",
      placeName: "Portland tx",
      kind: "plan-spot",
      sourceCatchId: "c-port",
    });
    const innertube = note({
      id: "p2",
      placeName: "Innertube cut",
      kind: "plan-spot",
    });
    const shamrock = note({
      id: "p3",
      placeName: "Shamrock",
      kind: "plan-spot",
    });
    const photos = photosForPlannedPlaces([portland, innertube, shamrock], [], [], {
      catches: [
        { id: "c-port", placeName: "Portland tx", photoPath: "portland.jpg" },
        { id: "c-tube", placeName: "Innertube cut", photoPath: "tube.jpg" },
        { id: "c-sham", placeName: "Shamrock", photoPath: "shamrock.jpg" },
      ],
    });
    expect(photos).toEqual([
      {
        id: "p1",
        placeName: "Portland tx",
        src: "/api/media/portland.jpg",
        href: "/catch/c-port",
      },
      {
        id: "p2",
        placeName: "Innertube cut",
        src: "/api/media/tube.jpg",
        href: "/catch/c-tube",
      },
      {
        id: "p3",
        placeName: "Shamrock",
        src: "/api/media/shamrock.jpg",
        href: "/catch/c-sham",
      },
    ]);
  });

  it("does not invent a bait photo when the added bait had none", () => {
    const bareBait = note({
      id: "bare-bait",
      placeName: "Haulover Canal",
      kind: "plan-spot",
      sourceBaitId: "b1",
    });
    const baitSuggestions = [
      {
        placeName: "Haulover Canal",
        matches: [{ baitSpot: { id: "other", photoPath: "other.jpg" } }],
      },
    ] as unknown as Parameters<typeof photosForPlannedPlaces>[2];
    expect(photosForPlannedPlaces([bareBait], [], baitSuggestions)).toEqual([]);
    expect(
      photosForPlannedPlaces([bareBait], [], [], {
        baitSpots: [{ id: "other", placeName: "Haulover Canal", photoPath: "other.jpg" }],
      }),
    ).toEqual([]);
  });
});

describe("Plan day labels", () => {
  it("saves an explicit title and shows a truncated copy on the calendar", () => {
    const spot = note({
      id: "spot",
      placeName: "Beach marker 42",
      speciesTargets: ["Redfish"],
      kind: "plan-spot",
    });
    const writeup = note({ id: "note", notes: "Try the flood." });
    expect(planDayLabel([])).toBeNull();
    expect(planDayLabel([spot])).toBeNull();
    expect(planDayLabel([spot, writeup])).toBeNull();
    expect(planDayLabel([note({ title: "Sharkathon" })])).toBe("Sharkathon");
    expect(planDayLabel([spot, note({ title: "Sharkathon", notes: "Meet at dawn." })])).toBe(
      "Sharkathon",
    );
    expect(planDayLabelNote([spot, writeup])?.id).toBe("note");
    expect(planDayLabelInput("2026-10-10", "  Sharkathon  ")).toEqual({
      day: "2026-10-10",
      title: "Sharkathon",
      notes: null,
      placeName: null,
      speciesTargets: [],
      kind: "journal",
    });
    expect(
      planDayLabelInput("2026-10-10", "Sharkathon weekend", {
        notes: "Meet at dawn.",
        placeName: null,
        speciesTargets: [],
      }),
    ).toEqual({
      day: "2026-10-10",
      title: "Sharkathon weekend",
      notes: "Meet at dawn.",
      placeName: null,
      speciesTargets: [],
      kind: "journal",
    });
    expect(planDayLabelInput("2026-10-10", "   ", writeup)).toEqual({
      day: "2026-10-10",
      title: null,
      notes: "Try the flood.",
      placeName: null,
      speciesTargets: [],
      kind: "journal",
    });
    expect(planDayLabelInput("2026-10-10", "")).toBeNull();
    expect(formatPlanCalendarLabel(null)).toBeNull();
    expect(formatPlanCalendarLabel("Sharkathon")).toBe("Sharkathon");
    expect(formatPlanCalendarLabel("Sharkathon")).toHaveLength(10);
    expect(PLAN_CALENDAR_LABEL_MAX).toBe(10);
    expect(PLAN_DAY_LABEL_MAX).toBe(32);
    expect(formatPlanCalendarLabel("Sharkathon weekend")).toBe("Sharkatho…");
    expect(labelsByPlanDay([spot, note({ day: "2026-10-11", title: "Island run" })]).get("2026-10-11")).toBe(
      "Island run",
    );
    expect(labelsByPlanDay([spot]).has("2026-10-10")).toBe(false);
    const titled = note({ id: "label", title: "Sharkathon" });
    expect(journalNotesForPlanWriteups([spot, titled])).toEqual([]);
    expect(journalNotesForPlanWriteups([spot, writeup]).map((n) => n.id)).toEqual(["note"]);
    expect(journalNotesForCalendarLog([titled]).map((n) => n.title)).toEqual(["Sharkathon"]);
  });
});

describe("noteHeadline", () => {
  it("prefers title, then place, then species, then notes", () => {
    expect(noteHeadline(note({ title: "Dawn flood" }))).toBe("Dawn flood");
    expect(noteHeadline(note({ placeName: "The lagoon" }))).toBe("The lagoon");
    expect(noteHeadline(note({ speciesTargets: ["Redfish", "Snook"] }))).toBe("Redfish, Snook");
    expect(noteHeadline(note({ notes: "Bring the popping cork." }))).toBe("Bring the popping cork.");
  });
});
