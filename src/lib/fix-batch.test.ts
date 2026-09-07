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

  it("uses one Edit on catch and bait detail, then Share, with larger share-with names", () => {
    const catchDetail = readFileSync(resolve(__dirname, "../components/CatchDetail.tsx"), "utf8");
    const baitDetail = readFileSync(resolve(__dirname, "../components/BaitSpotDetail.tsx"), "utf8");
    const picker = readFileSync(resolve(__dirname, "../components/ShareFriendPicker.tsx"), "utf8");
    const catchEdit = catchDetail.indexOf('data-testid="catch-edit"');
    const shareBlock = catchDetail.indexOf('data-testid="catch-share-block"');
    const shareBtn = catchDetail.indexOf('data-testid="catch-share"');
    const catchDelete = catchDetail.indexOf("Delete", catchEdit);
    expect(catchEdit).toBeGreaterThan(-1);
    expect(shareBlock).toBeGreaterThan(catchEdit);
    expect(shareBtn).toBeGreaterThan(shareBlock);
    expect(catchDelete).toBeGreaterThan(shareBlock);
    expect(catchDetail).not.toContain("Edit spot");
    expect(catchDetail).not.toContain("catch-edit-spot");
    expect(catchDetail.slice(catchEdit, shareBlock)).not.toContain("Delete");
    const baitEdit = baitDetail.indexOf('data-testid="bait-edit"');
    const baitShareBlock = baitDetail.indexOf('data-testid="bait-share-block"');
    const baitDelete = baitDetail.indexOf("Delete", baitEdit);
    expect(baitShareBlock).toBeGreaterThan(baitEdit);
    expect(baitDelete).toBeGreaterThan(baitShareBlock);
    expect(baitDetail).not.toContain("Edit spot");
    expect(baitDetail).not.toContain("bait-edit-spot");
    expect(baitDetail.slice(baitEdit, baitShareBlock)).not.toContain("Delete");
    expect(picker).toContain("text-2xl font-semibold");
    expect(picker).toContain("{buddy.name}");
    expect(picker).not.toContain("text-base font-semibold");
    expect(picker).not.toContain("text-lg font-semibold");
    expect(catchDetail).toContain('data-testid="catch-owner-actions"');
    expect(baitDetail).toContain('data-testid="bait-owner-actions"');
    expect(catchDetail).toContain("Boolean(viewerId && record.anglerId === viewerId)");
    expect(baitDetail).toContain("Boolean(viewerId && record.anglerId === viewerId)");
    expect(catchDetail).toContain("if (editing && isOwner)");
    expect(baitDetail).toContain("if (editing && isOwner)");
  });

  it("lets a single Edit change bait location on the same form as a catch", () => {
    const catchDetail = readFileSync(resolve(__dirname, "../components/CatchDetail.tsx"), "utf8");
    const baitDetail = readFileSync(resolve(__dirname, "../components/BaitSpotDetail.tsx"), "utf8");
    const baitForm = readFileSync(resolve(__dirname, "../components/BaitSpotForm.tsx"), "utf8");
    const catchForm = readFileSync(resolve(__dirname, "../components/CatchForm.tsx"), "utf8");
    expect(catchDetail).toContain('data-testid="catch-edit"');
    expect(catchDetail).toContain("<CatchForm");
    expect(catchDetail).toContain('mode="edit"');
    expect(catchDetail).not.toContain("Edit spot");
    expect(baitDetail).toContain('data-testid="bait-edit"');
    expect(baitDetail).toContain("<BaitSpotForm");
    expect(baitDetail).toContain('mode="edit"');
    expect(baitDetail).not.toContain("Edit spot");
    expect(catchForm).toContain('id="catch-location"');
    expect(catchForm).toContain("notes");
    expect(catchForm).toContain("caughtAt");
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
