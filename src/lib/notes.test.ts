import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addPlanSpotToDay,
  calendarNoteHasContent,
  dayHasPlanSpot,
  groupNotesByDay,
  expiredPlanNotes,
  isExpiredPlanDay,
  journalNotesForCalendarLog,
  noteHeadline,
  parseCalendarNoteInput,
  parseDayKey,
  parseSpeciesTargets,
  planDayPurgeBeforeKey,
  planNoteInput,
  planNotesOnDay,
  planSpotNoteInput,
  plannedSpotsOnDay,
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
    expect(plan).toContain("uniqueNotesByPlace");
    expect(plan).toContain("/api/calendar-notes?for=plan&today=");
    expect(plan).toContain("upcomingPlanNotes");
    expect(plan).toContain("onDeletePlan");
    expect(plan).toContain('confirm("Delete this plan?")');
    expect(plan).toContain("/api/calendar-notes?day=");
    expect(plan).toContain('data-testid="plan-delete-day"');
    expect(plan).toContain("Delete plan");
    expect(plan).toContain("journalNotesForCalendarLog");
    expect(plan).toContain('data-testid="plan-add-spot"');
    expect(plan).toContain("data-place-name");
    const calendar = readFileSync(resolve(__dirname, "../components/HistoryClient.tsx"), "utf8");
    expect(calendar).toContain("journalNotesForCalendarLog");
    expect(calendar).not.toContain("for=plan");
    expect(plan).toContain('data-testid="plan-suggested-spots"');
    expect(plan).toContain('data-testid="plan-day-spots"');
    expect(plan).toContain('data-testid="plan-planned"');
    expect(plan).toContain('data-testid="plan-planned-photos"');
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
    expect(notesApi).toContain("parseDayKey(request.nextUrl.searchParams.get(\"today\"))");
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
    expect(plan).toContain("void commitPendingSpot(date)");
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
});

describe("noteHeadline", () => {
  it("prefers title, then place, then species, then notes", () => {
    expect(noteHeadline(note({ title: "Dawn flood" }))).toBe("Dawn flood");
    expect(noteHeadline(note({ placeName: "The lagoon" }))).toBe("The lagoon");
    expect(noteHeadline(note({ speciesTargets: ["Redfish", "Snook"] }))).toBe("Redfish, Snook");
    expect(noteHeadline(note({ notes: "Bring the popping cork." }))).toBe("Bring the popping cork.");
  });
});
