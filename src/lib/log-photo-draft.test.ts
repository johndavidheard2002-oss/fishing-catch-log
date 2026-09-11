import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  shouldApplyHeldLogPhoto,
  shouldClearHeldLogPhotoAfterSave,
  shouldRestoreHeldLogPhoto,
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

describe("held Log photo restore", () => {
  it("restores only a blank live create, never edit / backfill / an already-chosen file", () => {
    expect(
      shouldRestoreHeldLogPhoto({
        mode: "create",
        pastMode: false,
        hasInitial: false,
        importedPhotoPath: null,
        hasPhotoFile: false,
      }),
    ).toBe(true);
    expect(
      shouldRestoreHeldLogPhoto({
        mode: "create",
        pastMode: false,
        hasInitial: false,
        importedPhotoPath: null,
        hasPhotoFile: true,
      }),
    ).toBe(false);
    expect(
      shouldRestoreHeldLogPhoto({
        mode: "edit",
        pastMode: false,
        hasInitial: true,
        importedPhotoPath: null,
        hasPhotoFile: false,
      }),
    ).toBe(false);
    expect(
      shouldRestoreHeldLogPhoto({
        mode: "create",
        pastMode: true,
        hasInitial: false,
        importedPhotoPath: "old.jpg",
        hasPhotoFile: false,
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
      }),
    ).toBe(true);
    expect(
      shouldApplyHeldLogPhoto({
        cancelled: false,
        hasBlob: true,
        restoreGeneration: 0,
        chosenGeneration: 1,
      }),
    ).toBe(false);
    expect(
      shouldApplyHeldLogPhoto({
        cancelled: true,
        hasBlob: true,
        restoreGeneration: 0,
        chosenGeneration: 0,
      }),
    ).toBe(false);
    expect(
      shouldApplyHeldLogPhoto({
        cancelled: false,
        hasBlob: false,
        restoreGeneration: 0,
        chosenGeneration: 0,
      }),
    ).toBe(false);
  });

  it("clears the hold after a create save, not after editing a saved catch", () => {
    expect(shouldClearHeldLogPhotoAfterSave({ mode: "create" })).toBe(true);
    expect(shouldClearHeldLogPhotoAfterSave({ mode: "edit" })).toBe(false);
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

  it("clearHeldOfflinePhoto removes an unsaved draft after an online save", async () => {
    await holdOfflinePhoto(new File([photoBlob()], "live.jpg", { type: "image/jpeg" }));
    await clearHeldOfflinePhoto();
    expect(await readHeldOfflinePhoto()).toBeNull();
  });
});

describe("CatchForm Log photo draft wiring", () => {
  const form = readFileSync(resolve(__dirname, "../components/CatchForm.tsx"), "utf8");

  it("guards restore with generation so a new photo cannot snap back to the hold", () => {
    expect(form).toContain("shouldRestoreHeldLogPhoto");
    expect(form).toContain("shouldApplyHeldLogPhoto");
    expect(form).toContain("photoChosenGenerationRef");
    expect(form).toContain("photoChosenGenerationRef.current += 1");
    const handleStart = form.indexOf("async function handleFile");
    const firstPreview = form.indexOf("showPreview", handleStart);
    const firstGps = form.indexOf("readPhotoGps", handleStart);
    expect(handleStart).toBeGreaterThan(-1);
    expect(firstPreview).toBeGreaterThan(handleStart);
    expect(firstPreview).toBeLessThan(firstGps);
  });

  it("clears the held draft after a successful create save", () => {
    expect(form).toContain("shouldClearHeldLogPhotoAfterSave");
    expect(form).toContain("clearHeldOfflinePhoto");
  });
});
