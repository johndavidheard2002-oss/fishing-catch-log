import { describe, expect, it } from "vitest";
import { HELP_SECTIONS } from "./help";

describe("HELP_SECTIONS", () => {
  it("covers the main Tide Mark flows in short steps", () => {
    const titles = HELP_SECTIONS.map((section) => section.title);
    expect(titles).toEqual([
      "Log a catch",
      "Location / map pin won’t drop",
      "Log bait",
      "Plan a day",
      "Calendar Log",
      "Your journal",
      "Free month and yearly journal",
      "Share with a friend",
      "Spots",
      "Backfill",
      "Swipe between tabs",
    ]);
    expect(
      HELP_SECTIONS.find((section) => section.title === "Log a catch")?.steps.some((step) =>
        step.includes("After sign-in") &&
        step.includes("Allow location") &&
        step.includes("Turn location on") &&
        step.includes("Camera"),
      ),
    ).toBe(true);
    expect(
      HELP_SECTIONS.find((section) => section.title === "Log a catch")?.steps.some((step) =>
        step.includes("Pick a species") && step.includes("later"),
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
    const locationHelp =
      HELP_SECTIONS.find((section) => section.title === "Location / map pin won’t drop")?.steps ?? [];
    expect(locationHelp[0]).toContain("Privacy & Security");
    expect(locationHelp[0]).toContain("Location Services");
    expect(locationHelp[1]).toContain("Safari Websites");
    expect(locationHelp[1]).toMatch(/Ask or While Using/);
    expect(locationHelp[1]).toContain("Never");
    expect(locationHelp.some((step) => step.includes("Private browsing"))).toBe(true);
    expect(locationHelp.some((step) => step.includes("Turn location on"))).toBe(true);
    expect(locationHelp.join(" ")).toContain("Safari → Location");
    expect(locationHelp.join(" ")).toContain("not enough");
    expect(locationHelp[0]).not.toContain("Settings → Safari → Location");
    const journal = HELP_SECTIONS.find((section) => section.title === "Your journal")?.steps ?? [];
    expect(journal.some((step) => step.includes("email") && step.includes("password"))).toBe(true);
    expect(journal.some((step) => step.includes("Allow location") && step.includes("Turn location on"))).toBe(true);
    expect(journal.some((step) => step.includes("Log out"))).toBe(true);
    expect(journal.some((step) => step.includes("first month") && step.includes("$39.99/year"))).toBe(true);
    const billing = HELP_SECTIONS.find((section) => section.title === "Free month and yearly journal")?.steps ?? [];
    expect(billing.some((step) => step.includes("Home stays open") && step.includes("$39.99/year"))).toBe(true);
    expect(billing.some((step) => step.includes("Nothing is deleted"))).toBe(true);
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
