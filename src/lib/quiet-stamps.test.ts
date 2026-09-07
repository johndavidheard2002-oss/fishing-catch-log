import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { demoTide } from "./tides/demo";
import { demoWeather } from "./weather/demo";
import { DROPPING_PIN_HINT, logLocationReason, logLocationSurface, PINNED_FROM_PHONE_HINT } from "./location";
import {
  MISSING_PHOTO_DATETIME_NOTE,
  MISSING_PHOTO_EXIF_NOTE,
  MISSING_PHOTO_LOCATION_NOTE,
  missingPhotoFieldsNote,
} from "./photo-gps";

const STAMP_RE = /openweather|open-meteo|moon phase|from this phone|live weather|pinned from this phone/i;

describe("Log stamps stay quiet unless something is missing", () => {
  it("does not advertise weather or moon source when values filled in", () => {
    const weather = demoWeather(28.74, -80.75, new Date("2026-09-06T12:00:00.000Z"));
    expect(weather.note).toBe("");
    expect(weather.temperatureF).not.toBeNull();
    expect(demoTide(28.74, -80.75, new Date("2026-09-06T12:00:00.000Z")).note).toBe("");
  });

  it("stays silent after a successful pin", () => {
    expect(logLocationReason("ready")).toBe("");
    expect(PINNED_FROM_PHONE_HINT).toBe("");
    expect(
      logLocationSurface({
        status: "ready",
        hasPin: true,
        photoAtCatch: true,
      }).reason,
    ).toBeNull();
    expect(DROPPING_PIN_HINT).toBe("Dropping pin…");
  });

  it("keeps missing-data notes accurate and short", () => {
    expect(MISSING_PHOTO_EXIF_NOTE).toMatch(/date, time, or location/i);
    expect(MISSING_PHOTO_DATETIME_NOTE).toMatch(/date or time/i);
    expect(MISSING_PHOTO_LOCATION_NOTE).toMatch(/location/i);
    expect(MISSING_PHOTO_LOCATION_NOTE).toMatch(/drop a pin/i);
    expect(
      missingPhotoFieldsNote({
        source: "camera",
        exifHasDateTime: false,
        exifHasLocation: false,
        liveHasDateTime: true,
        liveHasLocation: true,
      }),
    ).toBeNull();
  });

  it("removes source stamps from Log, bait, and photo UI copy", () => {
    const files = [
      "../components/CatchForm.tsx",
      "../components/BaitSpotForm.tsx",
      "../components/PhotoCapture.tsx",
      "../components/PlanClient.tsx",
      "./photo-gps.ts",
    ];
    for (const file of files) {
      expect(readFileSync(resolve(__dirname, file), "utf8"), file).not.toMatch(STAMP_RE);
    }
  });
});
