import { describe, expect, it } from "vitest";
import {
  calendarNoteHasContent,
  groupNotesByDay,
  noteHeadline,
  parseCalendarNoteInput,
  parseSpeciesTargets,
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

describe("noteHeadline", () => {
  it("prefers title, then place, then species, then notes", () => {
    expect(noteHeadline(note({ title: "Dawn flood" }))).toBe("Dawn flood");
    expect(noteHeadline(note({ placeName: "The lagoon" }))).toBe("The lagoon");
    expect(noteHeadline(note({ speciesTargets: ["Redfish", "Snook"] }))).toBe("Redfish, Snook");
    expect(noteHeadline(note({ notes: "Bring the popping cork." }))).toBe("Bring the popping cork.");
  });
});
