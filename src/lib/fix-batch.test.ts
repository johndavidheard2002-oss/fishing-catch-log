import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tide Mark next-pass UI contracts", () => {
  it("restores multi-species chip append on Log", () => {
    const picker = readFileSync(resolve(__dirname, "../components/SpeciesPicker.tsx"), "utf8");
    expect(picker).toContain("toggleSelectedSpecies");
    expect(picker).not.toContain("selected.length <= 1");
  });

  it("opens Calendar Log on Grid and keeps month/year scroll", () => {
    const history = readFileSync(resolve(__dirname, "../components/HistoryClient.tsx"), "utf8");
    const calendar = readFileSync(resolve(__dirname, "../components/HistoryCalendar.tsx"), "utf8");
    expect(history).toContain("resolveCalendarLogView");
    expect(history).toContain('{ id: "grid", label: "Grid" }');
    expect(calendar).toContain("calendarHeaderScrollDelta");
    expect(calendar).toContain("calendar-prev-year");
    expect(calendar).toContain("shiftYear");
  });

  it("lets bait Edit spot focus the map the same as a catch", () => {
    const baitDetail = readFileSync(resolve(__dirname, "../components/BaitSpotDetail.tsx"), "utf8");
    const baitForm = readFileSync(resolve(__dirname, "../components/BaitSpotForm.tsx"), "utf8");
    expect(baitDetail).toContain("Edit spot");
    expect(baitDetail).toContain('data-testid="bait-edit-spot"');
    expect(baitDetail).toContain("focusLocation={focusSpot}");
    expect(baitForm).toContain('id="bait-location"');
    expect(baitForm).toContain("isDuckHabitat");
  });

  it("shows the missing EXIF note on Log", () => {
    const form = readFileSync(resolve(__dirname, "../components/CatchForm.tsx"), "utf8");
    expect(form).toContain("missingPhotoFieldsNote");
    expect(form).toContain('data-testid="missing-exif-note"');
  });

  it("treats live Camera as supplied by the form, not EXIF-only", () => {
    const form = readFileSync(resolve(__dirname, "../components/CatchForm.tsx"), "utf8");
    expect(form).toContain("liveCamera");
    expect(form).toContain("liveHasDateTime");
    expect(form).toContain("liveHasLocation");
    expect(form).toContain("locationPending");
    expect(form).toContain('source: "camera"');
  });

  it("offers Open Settings when location is denied", () => {
    const prompt = readFileSync(resolve(__dirname, "../components/LiveLocationPrompt.tsx"), "utf8");
    const photo = readFileSync(resolve(__dirname, "../components/PhotoCapture.tsx"), "utf8");
    expect(prompt).toContain("OPEN_SETTINGS_LABEL");
    expect(prompt).toContain('data-testid="open-settings"');
    expect(photo).toContain("OPEN_SETTINGS_LABEL");
    expect(photo).toContain('data-testid="open-settings"');
  });
});
