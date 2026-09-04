import { describe, expect, it, vi } from "vitest";
import { decimalFromDms, gpsFromExifRecord, readPhotoGps } from "./photo-gps";

describe("decimalFromDms", () => {
  it("converts EXIF GPS arrays and hemisphere refs", () => {
    expect(decimalFromDms([28, 44, 24], "N")).toBeCloseTo(28.74, 5);
    expect(decimalFromDms([80, 45, 0], "W")).toBeCloseTo(-80.75, 5);
    expect(decimalFromDms(-97.92, "W")).toBeCloseTo(-97.92, 5);
    expect(decimalFromDms("nope")).toBeNull();
  });
});

describe("gpsFromExifRecord", () => {
  it("reads computed latitude/longitude when the browser left them in", () => {
    expect(gpsFromExifRecord({ latitude: 28.74, longitude: -80.75 })).toEqual({
      latitude: 28.74,
      longitude: -80.75,
    });
  });

  it("reads raw GPSLatitude arrays when computed keys are missing", () => {
    expect(
      gpsFromExifRecord({
        GPSLatitude: [28, 44, 24],
        GPSLatitudeRef: "N",
        GPSLongitude: [80, 45, 0],
        GPSLongitudeRef: "W",
      }),
    ).toEqual({
      latitude: expect.closeTo(28.74, 5),
      longitude: expect.closeTo(-80.75, 5),
    });
  });

  it("does not invent a pin when Safari stripped GPS", () => {
    expect(gpsFromExifRecord({ DateTimeOriginal: "2026:09:03 20:02:00" })).toBeNull();
    expect(gpsFromExifRecord(null)).toBeNull();
  });
});

describe("readPhotoGps", () => {
  it("prefers exifr.gps, then a GPS parse, and reads the original file", async () => {
    const file = new Blob(["heic"], { type: "image/heic" });
    const gps = vi.fn(async () => ({ latitude: 28.74, longitude: -80.75 }));
    const parse = vi.fn();
    await expect(readPhotoGps(file, { gps, parse })).resolves.toEqual({
      latitude: 28.74,
      longitude: -80.75,
    });
    expect(gps).toHaveBeenCalledWith(file);
    expect(parse).not.toHaveBeenCalled();
  });

  it("falls back to parse when gps() finds nothing", async () => {
    const file = new Blob(["heic"], { type: "image/heic" });
    await expect(
      readPhotoGps(file, {
        gps: async () => undefined,
        parse: async () => ({
          GPSLatitude: [29, 9, 0],
          GPSLatitudeRef: "N",
          GPSLongitude: [96, 52, 48],
          GPSLongitudeRef: "W",
        }),
      }),
    ).resolves.toEqual({
      latitude: expect.closeTo(29.15, 5),
      longitude: expect.closeTo(-96.88, 5),
    });
  });
});
