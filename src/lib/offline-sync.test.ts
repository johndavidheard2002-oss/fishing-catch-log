import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JOURNAL_LOCKED } from "./entitlement";
import { OFFLINE_PHOTO_HOLD_ID } from "./offline";
import {
  canSyncNow,
  enqueueOfflineLog,
  holdOfflinePhoto,
  queuedCatchRecords,
  readHeldOfflinePhoto,
  syncQueuedLogs,
  syncQueuedLogsIfOnline,
  updateQueuedLog,
} from "./offline-sync";
import { listQueuedLogs, memoryOfflineBackend, resetOfflineBackend, useOfflineBackend } from "./offline-store";

function photoBlob() {
  return new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "image/jpeg" });
}

function mockFetch(handlers: Record<string, (init?: RequestInit) => Promise<Response> | Response>) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const key = Object.keys(handlers).find((prefix) => url === prefix || url.startsWith(`${prefix}?`));
    if (!key) throw new TypeError(`Failed to fetch ${url}`);
    return handlers[key](init);
  };
}

beforeEach(() => {
  useOfflineBackend(memoryOfflineBackend());
});

afterEach(() => {
  resetOfflineBackend();
});

describe("offline photo hold and queue", () => {
  it("holds a camera photo on-device until save or sync", async () => {
    await holdOfflinePhoto(new File([photoBlob()], "live.jpg", { type: "image/jpeg" }));
    const held = await readHeldOfflinePhoto();
    expect(held).toBeTruthy();
    expect(held?.size).toBe(4);
    const queued = await listQueuedLogs();
    expect(queued.some((item) => item.id === OFFLINE_PHOTO_HOLD_ID)).toBe(true);
  });

  it("queues photo, form fields, and GPS as one draft log", async () => {
    const queued = await enqueueOfflineLog({
      payload: {
        species: "Redfish",
        latitude: 28.4,
        longitude: -96.4,
        caughtAt: "2026-09-08T12:00:00.000Z",
        habitat: "saltwater-inshore",
      },
      photo: new File([photoBlob()], "catch.jpg", { type: "image/jpeg" }),
      viewerId: "you",
    });
    expect(queued.hasPhotoBlob).toBe(true);
    expect(queued.needsConditions).toBe(true);
    expect(queued.payload.latitude).toBe(28.4);
    const records = await queuedCatchRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.species).toBe("Redfish");
    expect(records[0]?.photoPath?.startsWith("blob:")).toBe(true);
  });
});

describe("offline sync", () => {
  it("uploads the photo, posts the catch, then fills weather and tides", async () => {
    const queued = await enqueueOfflineLog({
      payload: {
        species: "Trout",
        latitude: 28.4,
        longitude: -96.4,
        caughtAt: "2026-09-08T12:00:00.000Z",
        habitat: "saltwater-inshore",
      },
      photo: new File([photoBlob()], "catch.jpg", { type: "image/jpeg" }),
    });

    const calls: string[] = [];
    const fetchImpl = mockFetch({
      "/api/media": async () => {
        calls.push("media");
        return Response.json({ photoPath: "uploaded.jpg" });
      },
      "/api/catches": async (init) => {
        calls.push("catches");
        const body = JSON.parse(String(init?.body ?? "{}")) as { photoPath?: string; temperatureF?: number };
        expect(body.photoPath).toBe("uploaded.jpg");
        expect(body.temperatureF).toBeUndefined();
        return Response.json({ catch: { id: "c-live" } }, { status: 201 });
      },
      "/api/assist/weather": async () => {
        calls.push("weather");
        return Response.json({
          weather: { temperatureF: 84, weatherCondition: "clear", windSpeedMph: 8 },
          tide: { applies: true, tide: "incoming", heightFt: 1.2, detail: "Incoming 1.2 ft" },
        });
      },
      "/api/catches/c-live": async (init) => {
        calls.push("patch");
        const body = JSON.parse(String(init?.body ?? "{}")) as { temperatureF?: number; tide?: string };
        expect(body.temperatureF).toBe(84);
        expect(body.tide).toBe("incoming");
        return Response.json({ catch: { id: "c-live" } });
      },
    });

    const result = await syncQueuedLogs({ fetch: fetchImpl as typeof fetch });
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results[0]?.catchId).toBe("c-live");
    expect(calls).toEqual(["media", "catches", "weather", "patch"]);
    expect(await listQueuedLogs()).toEqual([]);
    expect(queued.id.startsWith("pending-")).toBe(true);
  });

  it("keeps the queue when the journal is soft-locked", async () => {
    await enqueueOfflineLog({
      payload: { species: "Redfish", caughtAt: "2026-09-08T12:00:00.000Z" },
      photo: photoBlob(),
    });
    const locked = await syncQueuedLogs({ fetch: mockFetch({}), locked: true });
    expect(locked.synced).toBe(0);
    expect(locked.skippedLocked).toBe(1);
    expect(await listQueuedLogs()).toHaveLength(1);

    const fetchImpl = mockFetch({
      "/api/media": async () => Response.json({ error: JOURNAL_LOCKED, locked: true }, { status: 403 }),
    });
    const forbidden = await syncQueuedLogs({ fetch: fetchImpl as typeof fetch });
    expect(forbidden.skippedLocked).toBe(1);
    expect(await listQueuedLogs()).toHaveLength(1);
  });

  it("retries later when the service is still unreachable", async () => {
    await enqueueOfflineLog({
      payload: { species: "Redfish", caughtAt: "2026-09-08T12:00:00.000Z", latitude: 28, longitude: -96 },
      photo: photoBlob(),
    });
    const result = await syncQueuedLogs({
      fetch: (async () => {
        throw new TypeError("Failed to fetch");
      }) as typeof fetch,
    });
    expect(result.failed).toBe(1);
    expect(await listQueuedLogs()).toHaveLength(1);
  });

  it("does not sync an expired cached entitlement while offline-first", async () => {
    expect(
      canSyncNow({
        online: true,
        entitlement: {
          subscriptionStatus: "expired",
          trialStartedAt: "",
          trialEndsAt: "",
          trialDays: 30,
          daysRemaining: 0,
          msRemaining: 0,
          noticeWindow: null,
          yearlyPrice: "$29.99/year",
          purchaseAvailable: false,
        },
      }),
    ).toBe(false);
    expect(canSyncNow({ online: false })).toBe(false);
    const skipped = await syncQueuedLogsIfOnline({ online: false });
    expect(skipped.synced).toBe(0);
  });

  it("updates a queued draft in place", async () => {
    const queued = await enqueueOfflineLog({
      payload: { species: "Redfish", caughtAt: "2026-09-08T12:00:00.000Z" },
    });
    const updated = await updateQueuedLog(queued.id, {
      payload: { species: "Trout", latitude: 28.1, longitude: -96.2, caughtAt: "2026-09-08T12:00:00.000Z" },
    });
    expect(updated?.payload.species).toBe("Trout");
    expect(updated?.payload.latitude).toBe(28.1);
  });
});
