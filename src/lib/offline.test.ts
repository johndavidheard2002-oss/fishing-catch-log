import { describe, expect, it } from "vitest";
import { JOURNAL_LOCKED } from "./entitlement";
import {
  MANUAL_ENTRY_AFTER_RECONNECT,
  OFFLINE_CONDITIONS_FILL_LATER,
  OFFLINE_LOCATION_FILL_LATER,
  OFFLINE_LOG_SAVED,
  OFFLINE_MAP_TILES_NOTE,
  WAITING_FOR_SERVICE_CHIP,
  cachedJournalUnlocked,
  catchDetailHref,
  emptyApiConditions,
  isBrowserOnline,
  isNetworkFailure,
  isPendingCatchId,
  mergeJournalWithPending,
  needsManualEntryAfterReconnect,
  newPendingCatchId,
  offlineFormNotes,
  pendingCatchRecord,
  shouldQueueOfflineSave,
} from "./offline";
import { catchOf } from "./testing";

describe("offline copy", () => {
  it("keeps the locked Tide Mark offline family", () => {
    expect(OFFLINE_LOG_SAVED).toBe(
      "Offline. This log is saved on this phone. It will upload when service returns.",
    );
    expect(OFFLINE_LOG_SAVED.startsWith("Offline. This log is saved")).toBe(true);
    expect(OFFLINE_LOCATION_FILL_LATER).toContain("Location will fill");
    expect(OFFLINE_CONDITIONS_FILL_LATER).toContain("Weather, tides, and conditions will fill");
    expect(WAITING_FOR_SERVICE_CHIP).toBe("Waiting for service");
    expect(OFFLINE_MAP_TILES_NOTE).toContain("Map tiles need a connection");
    expect(MANUAL_ENTRY_AFTER_RECONNECT).toBe("Location or date-time still empty. Enter them by hand.");
  });
});

describe("offline queue rules", () => {
  it("queues only when the journal is unlocked and the service is unreachable", () => {
    expect(shouldQueueOfflineSave({ online: false })).toBe(true);
    expect(shouldQueueOfflineSave({ online: true, error: new TypeError("Failed to fetch") })).toBe(true);
    expect(shouldQueueOfflineSave({ locked: true, online: false })).toBe(false);
    expect(shouldQueueOfflineSave({ httpStatus: 403, error: new Error(JOURNAL_LOCKED) })).toBe(false);
    expect(shouldQueueOfflineSave({ httpStatus: 401 })).toBe(false);
    expect(shouldQueueOfflineSave({ online: true, error: new Error("Could not save") })).toBe(false);
  });

  it("treats fetch TypeErrors as a network failure", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure(new Error("Could not save"))).toBe(false);
    expect(isBrowserOnline({ onLine: false })).toBe(false);
    expect(isBrowserOnline({ onLine: true })).toBe(true);
    expect(isBrowserOnline(null)).toBe(true);
  });

  it("does not unlock a cached expired journal", () => {
    expect(
      cachedJournalUnlocked({
        subscriptionStatus: "expired",
        trialStartedAt: "",
        trialEndsAt: "",
        trialDays: 30,
        daysRemaining: 0,
        msRemaining: 0,
        noticeWindow: null,
        yearlyPrice: "$29.99/year",
        purchaseAvailable: false,
      }),
    ).toBe(false);
    expect(
      cachedJournalUnlocked({
        subscriptionStatus: "trial",
        trialStartedAt: "",
        trialEndsAt: "",
        trialDays: 30,
        daysRemaining: 10,
        msRemaining: 1,
        noticeWindow: null,
        yearlyPrice: "$29.99/year",
        purchaseAvailable: false,
      }),
    ).toBe(true);
  });
});

describe("offline journal helpers", () => {
  it("builds a pending catch from the queued photo, form, and GPS", () => {
    const id = newPendingCatchId();
    expect(isPendingCatchId(id)).toBe(true);
    const record = pendingCatchRecord({
      queued: {
        id,
        createdAt: "2026-09-08T12:00:00.000Z",
        payload: {
          species: "Redfish",
          speciesList: ["Redfish"],
          latitude: 28.41,
          longitude: -96.4,
          caughtAt: "2026-09-08T11:30:00.000Z",
          habitat: "saltwater-inshore",
          fishCount: 1,
        },
        photoName: "catch.jpg",
        photoType: "image/jpeg",
        hasPhotoBlob: true,
        serverPhotoPath: null,
        status: "queued",
        needsConditions: true,
        viewerId: "you",
      },
      photoPath: "blob:pending-photo",
    });
    expect(record.id).toBe(id);
    expect(record.species).toBe("Redfish");
    expect(record.latitude).toBe(28.41);
    expect(record.photoPath).toBe("blob:pending-photo");
    expect(emptyApiConditions(record)).toBe(true);
    expect(needsManualEntryAfterReconnect(record)).toBe(false);
  });

  it("asks for a manual entry when location or date-time are still empty", () => {
    expect(needsManualEntryAfterReconnect({ latitude: null, longitude: null, caughtAt: "2026-09-08T12:00:00Z" })).toBe(
      true,
    );
    expect(needsManualEntryAfterReconnect({ latitude: 28, longitude: -96, caughtAt: "" })).toBe(true);
    expect(needsManualEntryAfterReconnect({ latitude: 28, longitude: -96, caughtAt: "2026-09-08T12:00:00Z" })).toBe(
      false,
    );
  });

  it("shows fill-later notes only while offline", () => {
    expect(
      offlineFormNotes({
        online: false,
        hasLocation: false,
        mapTilesAvailable: false,
        hasApiConditions: false,
      }),
    ).toEqual([OFFLINE_LOCATION_FILL_LATER, OFFLINE_CONDITIONS_FILL_LATER, OFFLINE_MAP_TILES_NOTE]);
    expect(
      offlineFormNotes({
        online: true,
        hasLocation: false,
        mapTilesAvailable: false,
        hasApiConditions: false,
      }),
    ).toEqual([]);
  });

  it("opens pending or offline catches on the cached view route", () => {
    expect(catchDetailHref("pending-abc", true)).toBe("/catch/view?id=pending-abc");
    expect(catchDetailHref("c1", false)).toBe("/catch/view?id=c1");
    expect(catchDetailHref("c1", true)).toBe("/catch/c1");
  });

  it("merges queued logs in front of the cached journal", () => {
    const cached = [catchOf({ id: "c1" }), catchOf({ id: "pending-old" })];
    const pending = [catchOf({ id: "pending-old", species: "Trout" })];
    expect(mergeJournalWithPending(cached, pending).map((row) => row.id)).toEqual(["pending-old", "c1"]);
    expect(mergeJournalWithPending(cached, pending)[0]?.species).toBe("Trout");
  });
});
