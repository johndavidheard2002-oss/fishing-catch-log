import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tide Mark next-pass UI contracts", () => {
  it("restores multi-species chip append on Log", () => {
    const picker = readFileSync(resolve(__dirname, "../components/SpeciesPicker.tsx"), "utf8");
    expect(picker).toContain("toggleSelectedSpecies");
    expect(picker).not.toContain("selected.length <= 1");
  });

  it("opens Calendar Log on List with List, Calendar, Grid tabs", () => {
    const history = readFileSync(resolve(__dirname, "../components/HistoryClient.tsx"), "utf8");
    const calendarLib = readFileSync(resolve(__dirname, "./calendar.ts"), "utf8");
    const calendar = readFileSync(resolve(__dirname, "../components/HistoryCalendar.tsx"), "utf8");
    const historyRedirect = readFileSync(resolve(__dirname, "../app/history/page.tsx"), "utf8");
    expect(history).toContain("resolveCalendarLogView");
    expect(history).toContain("CALENDAR_LOG_VIEW_TABS");
    expect(history).toContain("DEFAULT_CALENDAR_LOG_VIEW");
    expect(calendarLib).toContain('["list", "calendar", "grid"]');
    expect(calendarLib).toContain('DEFAULT_CALENDAR_LOG_VIEW: CalendarLogView = "list"');
    expect(historyRedirect).toContain("DEFAULT_CALENDAR_LOG_VIEW");
    expect(historyRedirect).not.toContain('=== "grid"');
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

  it("centers the map on a typed town without dropping a pin", () => {
    const map = readFileSync(resolve(__dirname, "../components/MapPicker.tsx"), "utf8");
    const picker = readFileSync(resolve(__dirname, "../components/AreaNamePicker.tsx"), "utf8");
    const catchForm = readFileSync(resolve(__dirname, "../components/CatchForm.tsx"), "utf8");
    const bait = readFileSync(resolve(__dirname, "../components/BaitSpotForm.tsx"), "utf8");
    const focusFn = map.slice(map.indexOf("function applyTownFocus"), map.indexOf("const PIN_BOX"));
    expect(picker).toContain("onLookupTown");
    expect(picker).toContain("Type a town to move the map");
    expect(picker).toContain("preventDefault");
    expect(map).toContain("focusCenter");
    expect(focusFn).toContain("setView");
    expect(focusFn).toContain("fitBounds");
    expect(focusFn).not.toContain("onChange");
    expect(catchForm).toContain("lookupTown");
    expect(catchForm).toContain("focusCenter={focusCenter}");
    expect(bait).toContain("lookupTown");
    expect(bait).toContain("focusCenter={focusCenter}");
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
