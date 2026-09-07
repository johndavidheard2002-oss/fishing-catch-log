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
        step.includes("Tap a match") && step.includes("photo and map"),
      ),
    ).toBe(true);
    expect(
      HELP_SECTIONS.find((section) => section.title === "Plan a day")?.steps.join(" "),
    ).not.toContain("Show spot on map");
    expect(
      HELP_SECTIONS.find((section) => section.title === "Plan a day")?.steps.some((step) =>
        step.includes("Tap Add") && step.includes("that day"),
      ),
    ).toBe(true);
    expect(
      HELP_SECTIONS.find((section) => section.title === "Plan a day")?.steps.some((step) =>
        step.includes("Plan between Share and Delete") && step.includes("pick the day"),
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
    expect(locationHelp[0]).toContain("Private Relay");
    expect(locationHelp[1]).toContain("Location Services");
    expect(locationHelp[2]).toContain("Tide Mark");
    expect(locationHelp[2]).toContain("While Using");
    expect(locationHelp.some((step) => step.includes("delete the app"))).toBe(true);
    expect(locationHelp.some((step) => step.includes("clear sky"))).toBe(true);
    expect(locationHelp.some((step) => step.includes("Open Settings"))).toBe(true);
    expect(locationHelp.some((step) => step.includes("Safari Websites"))).toBe(true);
    expect(locationHelp.join(" ")).not.toContain("Settings → Safari → Location");
    expect(locationHelp[0]).not.toContain("Settings → Safari → Location");
    const journal = HELP_SECTIONS.find((section) => section.title === "Your journal")?.steps ?? [];
    expect(journal.some((step) => step.includes("email") && step.includes("password"))).toBe(true);
    expect(journal.some((step) => step.includes("Allow location") && step.includes("Turn location on"))).toBe(true);
    expect(journal.some((step) => step.includes("Log out"))).toBe(true);
    expect(journal.some((step) => step.includes("first month") && step.includes("$39.99/year"))).toBe(true);
    const billing = HELP_SECTIONS.find((section) => section.title === "Free month and yearly journal")?.steps ?? [];
    expect(billing.some((step) => step.includes("Home stays open") && step.includes("$39.99/year"))).toBe(true);
    expect(billing.some((step) => step.includes("Nothing is deleted"))).toBe(true);
    expect(
      billing.some((step) => step.includes("iPhone") && step.includes("App Store") && step.includes("Restore")),
    ).toBe(true);
    const share = HELP_SECTIONS.find((section) => section.title === "Share with a friend")?.steps ?? [];
    expect(share.some((step) => step.includes("More") && step.includes("Linked friends") && step.includes("Link"))).toBe(
      true,
    );
    expect(share.some((step) => step.includes("Share under Edit") && step.includes("Choose the friend"))).toBe(true);
    expect(share.some((step) => step.includes("Select spots to share"))).toBe(true);
    expect(share.some((step) => step.includes("Shared tab"))).toBe(true);
    const calendarHelp = HELP_SECTIONS.find((section) => section.title === "Calendar Log")?.steps ?? [];
    expect(calendarHelp.some((step) => step.includes("List, Calendar, Grid, then Shared"))).toBe(true);
    expect(calendarHelp.some((step) => step.includes("Calendar still links"))).toBe(true);
    expect(
      calendarHelp.some(
        (step) => step.includes("Add to plan") && step.includes("bait") && step.includes("pick the day"),
      ),
    ).toBe(true);
    const spotsHelp = HELP_SECTIONS.find((section) => section.title === "Spots")?.steps ?? [];
    expect(
      spotsHelp.some((step) => step.includes("Add to plan") && step.includes("bait") && step.includes("Plan")),
    ).toBe(true);
    expect(share.some((step) => step.includes("Never public") && step.includes("Linking shares nothing"))).toBe(true);
    expect(share.join(" ")).not.toMatch(/add someone on this phone/i);
    expect(share.join(" ")).not.toMatch(/second name on this journal/i);
    expect(share.join(" ")).not.toMatch(/who is logging/i);
    for (const section of HELP_SECTIONS) {
      expect(section.steps.length).toBeGreaterThan(0);
      expect(section.steps.every((step) => step.length < 160)).toBe(true);
      expect(`${section.title} ${section.steps.join(" ")}`.toLowerCase()).not.toContain("buddy");
    }
  });
});
