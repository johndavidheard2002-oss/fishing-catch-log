import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHANGES_SAVED_LABEL } from "./feedback";

describe("Changes saved feedback", () => {
  it("shows the same confirmation on catch, bait, and calendar note saves", () => {
    expect(CHANGES_SAVED_LABEL).toBe("Changes saved");
    const catchForm = readFileSync(resolve(__dirname, "../components/CatchForm.tsx"), "utf8");
    const catchDetail = readFileSync(resolve(__dirname, "../components/CatchDetail.tsx"), "utf8");
    const baitForm = readFileSync(resolve(__dirname, "../components/BaitSpotForm.tsx"), "utf8");
    const baitDetail = readFileSync(resolve(__dirname, "../components/BaitSpotDetail.tsx"), "utf8");
    const notes = readFileSync(resolve(__dirname, "../components/CalendarNotes.tsx"), "utf8");
    for (const source of [catchForm, catchDetail, baitForm, baitDetail, notes]) {
      expect(source).toContain("CHANGES_SAVED_LABEL");
      expect(source).toContain('data-testid="changes-saved"');
    }
  });
});
