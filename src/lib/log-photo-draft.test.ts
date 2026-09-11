import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LOG_PHOTO_DRAFT_SESSION_KEY,
  LOG_PHOTO_HOLD_MIGRATION_KEY,
  clearLogPhotoSessionDraft,
  isLogPhotoSessionDraft,
  markLogPhotoSessionDraft,
  markStaleHoldMigrationDone,
  shouldApplyHeldLogPhoto,
  shouldClearHeldLogPhotoAfterSave,
  shouldClearStaleHeldLogPhoto,
  shouldRemountLogFormAfterPageShow,
  shouldRestoreHeldLogPhoto,
  shouldRunStaleHoldMigration,
  shouldShowPhotoAtCatchPrompt,
} from "./log-photo-draft";
import { OFFLINE_PHOTO_HOLD_ID } from "./offline";
import {
  clearHeldOfflinePhoto,
  enqueueOfflineLog,
  holdOfflinePhoto,
  readHeldOfflinePhoto,
} from "./offline-sync";
import { listQueuedLogs, memoryOfflineBackend, resetOfflineBackend, useOfflineBackend } from "./offline-store";

function photoBlob() {
  return new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "image/jpeg" });
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = { ...initial };
  return {
    get length() {
      return Object.keys(data).length;
    },
    clear() {
      for (const key of Object.keys(data)) delete data[key];
    },
    getItem(key) {
      return data[key] ?? null;
    },
    key(index) {
      return Object.keys(data)[index] ?? null;
    },
    removeItem(key) {
      delete data[key];
    },
    setItem(key, value) {
      data[key] = String(value);
    },
  };
}

describe("held Log photo restore", () => {
  it("restores only a same-session unsaved draft, never a leftover last save", () => {
    expect(
      shouldRestoreHeldLogPhoto({
        mode: "create",
        pastMode: false,
        hasInitial: false,
        importedPhotoPath: null,
        hasPhotoFile: false,
        hasSessionDraft: true,
      }),
    ).toBe(true);
    expect(
      shouldRestoreHeldLogPhoto({
        mode: "create",
        pastMode: false,
        hasInitial: false,
        importedPhotoPath: null,
        hasPhotoFile: false,
        hasSessionDraft: false,
      }),
    ).toBe(false);
    expect(
      shouldRestoreHeldLogPhoto({
        mode: "create",
        pastMode: false,
        hasInitial: false,
        importedPhotoPath: null,
        hasPhotoFile: true,
        hasSessionDraft: true,
      }),
    ).toBe(false);
    expect(
      shouldRestoreHeldLogPhoto({
        mode: "edit",
        pastMode: false,
        hasInitial: true,
        importedPhotoPath: null,
        hasPhotoFile: false,
        hasSessionDraft: true,
      }),
    ).toBe(false);
  });

  it("does not apply a late hold over a Camera / roll pick that landed first", () => {
    expect(
      shouldApplyHeldLogPhoto({
        cancelled: false,
        hasBlob: true,
        restoreGeneration: 0,
        chosenGeneration: 0,
        hasSessionDraft: true,
      }),
    ).toBe(true);
    expect(
      shouldApplyHeldLogPhoto({
        cancelled: false,
        hasBlob: true,
        restoreGeneration: 0,
        chosenGeneration: 1,
        hasSessionDraft: true,
      }),
    ).toBe(false);
    expect(
      shouldApplyHeldLogPhoto({
        cancelled: false,
        hasBlob: true,
        restoreGeneration: 0,
        chosenGeneration: 0,
        hasSessionDraft: false,
      }),
    ).toBe(false);
  });

  it("clears the hold after a create save, not after editing a saved catch", () => {
    expect(shouldClearHeldLogPhotoAfterSave({ mode: "create" })).toBe(true);
    expect(shouldClearHeldLogPhotoAfterSave({ mode: "edit" })).toBe(false);
  });

  it("clears a leftover hold when Log opens without a mid-draft", () => {
    expect(shouldClearStaleHeldLogPhoto({ hasSessionDraft: false })).toBe(true);
    expect(shouldClearStaleHeldLogPhoto({ hasSessionDraft: true })).toBe(false);
  });

  it("shows Yes/No for a Camera-roll file, not after live Camera or with an empty well", () => {
    expect(
      shouldShowPhotoAtCatchPrompt({
        busy: false,
        photoAtCatch: null,
        hasPhotoFile: true,
        mode: "create",
      }),
    ).toBe(true);
    expect(
      shouldShowPhotoAtCatchPrompt({
        busy: false,
        photoAtCatch: null,
        hasPhotoFile: false,
        mode: "create",
      }),
    ).toBe(false);
    expect(
      shouldShowPhotoAtCatchPrompt({
        busy: false,
        photoAtCatch: true,
        hasPhotoFile: true,
        mode: "create",
      }),
    ).toBe(false);
  });

  it("remounts a bfcache Log unless this tab still has an unsaved mid-draft", () => {
    expect(shouldRemountLogFormAfterPageShow({ persisted: true, hasSessionDraft: false })).toBe(true);
    expect(shouldRemountLogFormAfterPageShow({ persisted: true, hasSessionDraft: true })).toBe(false);
    expect(shouldRemountLogFormAfterPageShow({ persisted: false, hasSessionDraft: false })).toBe(false);
  });
});

describe("session draft and stale-hold migration", () => {
  it("marks and clears a same-tab unsaved pick", () => {
    const session = memoryStorage();
    expect(isLogPhotoSessionDraft(session)).toBe(false);
    markLogPhotoSessionDraft(session);
    expect(session.getItem(LOG_PHOTO_DRAFT_SESSION_KEY)).toBe("1");
    expect(isLogPhotoSessionDraft(session)).toBe(true);
    clearLogPhotoSessionDraft(session);
    expect(isLogPhotoSessionDraft(session)).toBe(false);
  });

  it("runs the one-time hold clear until the upgrade flag is set", () => {
    const local = memoryStorage();
    expect(shouldRunStaleHoldMigration(local)).toBe(true);
    markStaleHoldMigrationDone(local);
    expect(local.getItem(LOG_PHOTO_HOLD_MIGRATION_KEY)).toBe("1");
    expect(shouldRunStaleHoldMigration(local)).toBe(false);
  });
});

describe("held Log photo storage", () => {
  beforeEach(() => {
    useOfflineBackend(memoryOfflineBackend());
  });

  afterEach(() => {
    resetOfflineBackend();
  });

  it("drops the hold when a log is queued so the next Log is not the last photo", async () => {
    await holdOfflinePhoto(new File([photoBlob()], "live.jpg", { type: "image/jpeg" }));
    expect(await readHeldOfflinePhoto()).toBeTruthy();
    await enqueueOfflineLog({
      payload: { species: "Redfish", caughtAt: "2026-09-08T12:00:00.000Z" },
      photo: new File([photoBlob()], "catch.jpg", { type: "image/jpeg" }),
    });
    expect(await readHeldOfflinePhoto()).toBeNull();
    expect((await listQueuedLogs()).some((item) => item.id === OFFLINE_PHOTO_HOLD_ID)).toBe(false);
  });

  it("clearHeldOfflinePhoto wins over an in-flight hold write", async () => {
    const first = holdOfflinePhoto(new File([photoBlob()], "old.jpg", { type: "image/jpeg" }));
    const clear = clearHeldOfflinePhoto();
    await Promise.all([first, clear]);
    expect(await readHeldOfflinePhoto()).toBeNull();
  });
});

describe("CatchForm Log photo draft wiring", () => {
  const form = readFileSync(resolve(__dirname, "../components/CatchForm.tsx"), "utf8");

  it("gates restore on a same-session draft and bumps generation before EXIF", () => {
    expect(form).toContain("shouldRestoreHeldLogPhoto");
    expect(form).toContain("hasSessionDraft: isLogPhotoSessionDraft()");
    expect(form).toContain("markLogPhotoSessionDraft");
    expect(form).toContain("discardLogPhotoDraft");
    expect(form).toContain("clearLogPhotoSessionDraft");
    const handleStart = form.indexOf("async function handleFile");
    const firstPreview = form.indexOf("showPreview", handleStart);
    const firstGps = form.indexOf("readPhotoGps", handleStart);
    expect(firstPreview).toBeGreaterThan(handleStart);
    expect(firstPreview).toBeLessThan(firstGps);
  });

  it("clears session draft and hold after a successful create save", () => {
    expect(form).toContain("shouldClearHeldLogPhotoAfterSave");
    expect(form).toContain("clearHeldOfflinePhoto");
    expect(form).toContain("showPreview(null, { force: true })");
  });

  it("keeps Camera roll on Yes/No and shows the new preview before EXIF work", () => {
    expect(form).toContain('data-testid="photo-at-catch-prompt"');
    expect(form).toContain("shouldShowPhotoAtCatchPrompt");
    const handleStart = form.indexOf("async function handleFile");
    const atCatch = form.indexOf("setPhotoAtCatch", handleStart);
    const firstAwait = form.indexOf("await readPhotoGps", handleStart);
    expect(atCatch).toBeGreaterThan(handleStart);
    expect(atCatch).toBeLessThan(firstAwait);
  });
});

describe("LogClient photo draft remount", () => {
  const log = readFileSync(resolve(__dirname, "../components/LogClient.tsx"), "utf8");

  it("clears stale holds before CatchForm mounts, then remounts bfcache without a mid-draft", () => {
    expect(log).toContain("shouldRunStaleHoldMigration");
    expect(log).toContain("shouldClearStaleHeldLogPhoto");
    expect(log).toContain("clearHeldOfflinePhoto");
    expect(log).toContain("holdReady");
    expect(log).toContain("shouldRemountLogFormAfterPageShow");
    expect(log).toContain("hasSessionDraft: isLogPhotoSessionDraft()");
    expect(log).toContain("<CatchForm key={formEpoch} mode=\"create\" />");
  });
});
