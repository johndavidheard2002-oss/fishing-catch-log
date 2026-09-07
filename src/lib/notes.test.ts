import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addPlanSpotToDay,
  calendarNoteHasContent,
  dayHasPlanSpot,
  groupNotesByDay,
  noteHeadline,
  parseCalendarNoteInput,
  parseSpeciesTargets,
  planNoteInput,
  planSpotNoteInput,
  plannedSpotsOnDay,
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
  it("treats a matching place on that day as already added", () => {
    const notes = [note({ placeName: "Mosquito Lagoon, FL" })];
    expect(dayHasPlanSpot(notes, "mosquito lagoon, fl")).toBe(true);
    expect(dayHasPlanSpot(notes, "Haulover Canal")).toBe(false);
    expect(dayHasPlanSpot([], "Mosquito Lagoon, FL")).toBe(false);
  });

  it("lists places already attached to the day", () => {
    const spot = note({ id: "s", placeName: "Haulover Canal", speciesTargets: ["Redfish"] });
    const writeup = note({ id: "w", notes: "Wind east 10." });
    expect(plannedSpotsOnDay([spot, writeup]).map((n) => n.placeName)).toEqual(["Haulover Canal"]);
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
    });
    const afterAdd = [note({ placeName: first!.placeName })];
    expect(dayHasPlanSpot(afterAdd, "Haulover Canal")).toBe(true);
    expect(addPlanSpotToDay(afterAdd, "2026-09-10", { placeName: "haulover canal" })).toBeNull();
    expect(
      addPlanSpotToDay(afterAdd, "2026-09-10", { placeName: "Mosquito Lagoon" })?.placeName,
    ).toBe("Mosquito Lagoon");
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
    expect(plan).toContain('data-testid="plan-add-spot"');
    expect(plan).toContain('data-testid="plan-suggested-spots"');
    expect(plan).toContain('data-testid="plan-day-spots"');
    expect(plan).toContain("Tap Add on a suggested spot");
    expect(plan).toContain("{added ? \"Added\" : adding ? \"Adding…\" : \"Add\"}");
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
