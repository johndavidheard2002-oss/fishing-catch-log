import { describe, expect, it } from "vitest";
import { HELP_SECTIONS } from "./help";

describe("HELP_SECTIONS", () => {
  it("covers the main Catch Compass flows in short steps", () => {
    const titles = HELP_SECTIONS.map((section) => section.title);
    expect(titles).toEqual([
      "Log a catch",
      "Log bait",
      "Plan a day",
      "Calendar Log",
      "Spots",
      "Backfill",
      "Swipe between tabs",
    ]);
    for (const section of HELP_SECTIONS) {
      expect(section.steps.length).toBeGreaterThan(0);
      expect(section.steps.every((step) => step.length < 160)).toBe(true);
    }
  });
});
