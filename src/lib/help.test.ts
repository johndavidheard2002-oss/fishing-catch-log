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
      "Your journal",
      "Share with a friend",
      "Spots",
      "Backfill",
      "Swipe between tabs",
    ]);
    expect(
      HELP_SECTIONS.find((section) => section.title === "Log a catch")?.steps.some((step) =>
        step.includes("After sign-in") &&
        step.includes("Allow location") &&
        step.includes("this phone’s location") &&
        step.includes("Then tap Camera"),
      ),
    ).toBe(true);
    expect(
      HELP_SECTIONS.find((section) => section.title === "Log a catch")?.steps.some((step) =>
        step.includes("Pick a saltwater species") && step.includes("later"),
      ),
    ).toBe(true);
    expect(
      HELP_SECTIONS.find((section) => section.title === "Plan a day")?.steps.some((step) =>
        step.includes("Tap a match"),
      ),
    ).toBe(true);
    expect(
      HELP_SECTIONS.find((section) => section.title === "Backfill")?.steps.some((step) =>
        step.includes("not marked unlikely"),
      ),
    ).toBe(true);
    expect(
      HELP_SECTIONS.find((section) => section.title === "Backfill")?.steps.some((step) =>
        step.includes("No camera on Backfill"),
      ),
    ).toBe(true);
    expect(
      HELP_SECTIONS.find((section) => section.title === "Backfill")?.steps.some((step) =>
        step.includes("How this works"),
      ),
    ).toBe(true);
    const journal = HELP_SECTIONS.find((section) => section.title === "Your journal")?.steps ?? [];
    expect(journal.some((step) => step.includes("email") && step.includes("password"))).toBe(true);
    expect(journal.some((step) => step.includes("Allow location") && step.includes("Turn location on"))).toBe(true);
    expect(journal.some((step) => step.includes("Log out"))).toBe(true);
    const share = HELP_SECTIONS.find((section) => section.title === "Share with a friend")?.steps ?? [];
    expect(share.some((step) => step.includes("More") && step.includes("Linked friends") && step.includes("Link"))).toBe(
      true,
    );
    expect(share.some((step) => step.includes("Share next to Edit"))).toBe(true);
    expect(share.some((step) => step.includes("Select spots to share"))).toBe(true);
    expect(share.some((step) => step.includes("Include shared from linked friends"))).toBe(true);
    expect(share.some((step) => step.includes("Never public") && step.includes("Linking shares nothing"))).toBe(true);
    for (const section of HELP_SECTIONS) {
      expect(section.steps.length).toBeGreaterThan(0);
      expect(section.steps.every((step) => step.length < 160)).toBe(true);
      expect(`${section.title} ${section.steps.join(" ")}`.toLowerCase()).not.toContain("buddy");
    }
  });
});
