import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tide Mark next-pass UI contracts", () => {
  it("restores multi-species chip append on Log", () => {
    const picker = readFileSync(resolve(__dirname, "../components/SpeciesPicker.tsx"), "utf8");
    expect(picker).toContain("toggleSelectedSpecies");
    expect(picker).not.toContain("selected.length <= 1");
  });

  it("opens Calendar Log on List with List, Calendar, Grid, Shared tabs", () => {
    const history = readFileSync(resolve(__dirname, "../components/HistoryClient.tsx"), "utf8");
    const calendarLib = readFileSync(resolve(__dirname, "./calendar.ts"), "utf8");
    const calendar = readFileSync(resolve(__dirname, "../components/HistoryCalendar.tsx"), "utf8");
    const historyRedirect = readFileSync(resolve(__dirname, "../app/history/page.tsx"), "utf8");
    const calendarPage = readFileSync(resolve(__dirname, "../app/calendar/page.tsx"), "utf8");
    expect(history).toContain("resolveCalendarLogView");
    expect(history).toContain("CALENDAR_LOG_VIEW_TABS");
    expect(history).toContain("DEFAULT_CALENDAR_LOG_VIEW");
    expect(history).toContain("ownJournalRecords");
    expect(history).toContain("friendSharedRecords");
    expect(history).toContain('view === "shared"');
    expect(history).toContain("calendar-log-shared-feed");
    expect(history).toContain("calendar-log-own-feed");
    expect(history).toContain("grid-cols-4");
    expect(history).toContain("sharedQuery(true)");
    expect(history).not.toContain("SharedToggle");
    expect(history).not.toContain("useIncludeShared");
    expect(history).toContain("catches={filtered}");
    expect(history).toContain("baitSpots={baitSpots}");
    expect(history).not.toContain("catches={ownCatches}");
    expect(calendarLib).toContain('["list", "calendar", "grid", "shared"]');
    expect(calendarLib).toContain('DEFAULT_CALENDAR_LOG_VIEW: CalendarLogView = "list"');
    expect(calendarPage).toContain("includeShared: true");
    expect(historyRedirect).toContain("DEFAULT_CALENDAR_LOG_VIEW");
    expect(historyRedirect).not.toContain('=== "grid"');
    expect(calendar).toContain("calendarHeaderScrollDelta");
    expect(calendar).toContain("calendar-prev-year");
    expect(calendar).toContain("shiftYear");
  });

  it("puts Share under Edit and makes share-with names a little bigger", () => {
    const catchDetail = readFileSync(resolve(__dirname, "../components/CatchDetail.tsx"), "utf8");
    const baitDetail = readFileSync(resolve(__dirname, "../components/BaitSpotDetail.tsx"), "utf8");
    const picker = readFileSync(resolve(__dirname, "../components/ShareFriendPicker.tsx"), "utf8");
    const editRowEnd = catchDetail.indexOf('data-testid="catch-edit-spot"');
    const shareBlock = catchDetail.indexOf('data-testid="catch-share-block"');
    const shareBtn = catchDetail.indexOf('data-testid="catch-share"');
    expect(editRowEnd).toBeGreaterThan(-1);
    expect(shareBlock).toBeGreaterThan(editRowEnd);
    expect(shareBtn).toBeGreaterThan(shareBlock);
    expect(catchDetail.slice(catchDetail.indexOf("flex flex-wrap gap-2"), shareBlock)).not.toContain(
      "catch-share",
    );
    const baitEdit = baitDetail.indexOf('data-testid="bait-edit-spot"');
    const baitShareBlock = baitDetail.indexOf('data-testid="bait-share-block"');
    expect(baitShareBlock).toBeGreaterThan(baitEdit);
    expect(baitDetail.slice(baitDetail.indexOf("flex flex-wrap gap-2"), baitShareBlock)).not.toContain(
      "bait-share",
    );
    expect(picker).toContain("text-base font-semibold");
    expect(picker).toContain("{buddy.name}");
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
