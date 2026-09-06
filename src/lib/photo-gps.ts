import exifr from "exifr";
import type { PhotoGps } from "./location";

/** GPS-only parse. Do not reuse PHOTO_EXIF_OPTIONS — that pick list is for the clock. */
export const PHOTO_GPS_EXIF_OPTIONS = {
  gps: true,
  reviveValues: true,
  translateKeys: true,
  translateValues: true,
  mergeOutput: true,
  firstChunkSize: 256 * 1024,
  chunkSize: 128 * 1024,
  chunkLimit: 8,
  pick: [
    "latitude",
    "longitude",
    "GPSLatitude",
    "GPSLongitude",
    "GPSLatitudeRef",
    "GPSLongitudeRef",
  ],
};

export type PhotoExifReaders = {
  gps?: (input: Blob) => Promise<unknown>;
  parse?: (input: Blob, options?: typeof PHOTO_GPS_EXIF_OPTIONS) => Promise<unknown>;
};

export function decimalFromDms(dms: unknown, ref?: unknown): number | null {
  const values = Array.isArray(dms)
    ? dms.map(Number)
    : typeof dms === "number"
      ? [dms]
      : null;
  if (!values?.length || !values.every(Number.isFinite)) return null;
  const [deg = 0, min = 0, sec = 0] = values;
  let dec = Math.abs(deg) + min / 60 + sec / 3600;
  const hemi = typeof ref === "string" ? ref.trim().toUpperCase() : "";
  if (hemi === "S" || hemi === "W" || deg < 0) dec = -Math.abs(dec);
  return Number.isFinite(dec) ? dec : null;
}

/** Accept decimal lat/lng or raw EXIF DMS arrays. */
export function gpsFromExifRecord(exif: unknown): PhotoGps | null {
  if (!exif || typeof exif !== "object") return null;
  const rec = exif as Record<string, unknown>;
  const nested =
    rec.gps && typeof rec.gps === "object" ? (rec.gps as Record<string, unknown>) : rec;
  if (
    typeof nested.latitude === "number" &&
    typeof nested.longitude === "number" &&
    Number.isFinite(nested.latitude) &&
    Number.isFinite(nested.longitude)
  ) {
    return { latitude: nested.latitude, longitude: nested.longitude };
  }
  const lat = decimalFromDms(
    nested.GPSLatitude ?? rec.GPSLatitude,
    nested.GPSLatitudeRef ?? rec.GPSLatitudeRef,
  );
  const lon = decimalFromDms(
    nested.GPSLongitude ?? rec.GPSLongitude,
    nested.GPSLongitudeRef ?? rec.GPSLongitudeRef,
  );
  if (lat == null || lon == null) return null;
  return { latitude: lat, longitude: lon };
}

/**
 * Read photo GPS from the original file (before recompress). Safari may still
 * strip location from a library blob — callers must not treat a miss as “no pin”.
 */
export async function readPhotoGps(
  file: Blob,
  readers: PhotoExifReaders = {},
): Promise<PhotoGps | null> {
  const gps = readers.gps ?? ((input: Blob) => exifr.gps(input));
  const parse =
    readers.parse ?? ((input: Blob, options?: typeof PHOTO_GPS_EXIF_OPTIONS) => exifr.parse(input, options));
  try {
    const dedicated = await gps(file);
    const fromDedicated = gpsFromExifRecord(dedicated);
    if (fromDedicated) return fromDedicated;
  } catch {
    /* HEIC / missing GPS helper */
  }
  try {
    return gpsFromExifRecord(await parse(file, PHOTO_GPS_EXIF_OPTIONS));
  } catch {
    return null;
  }
}

export const MISSING_PHOTO_EXIF_NOTE =
  "No date, time, or location on this photo. Set those manually.";
export const MISSING_PHOTO_DATETIME_NOTE = "No date or time on this photo. Set those manually.";
export const MISSING_PHOTO_LOCATION_NOTE = "No location on this photo. Drop a pin.";

/** Shown when a library photo is missing the clock, GPS, or both. */
export function missingPhotoExifNote(args: {
  hasDateTime: boolean;
  hasLocation: boolean;
}): string | null {
  if (args.hasDateTime && args.hasLocation) return null;
  if (!args.hasDateTime && !args.hasLocation) return MISSING_PHOTO_EXIF_NOTE;
  if (!args.hasDateTime) return MISSING_PHOTO_DATETIME_NOTE;
  return MISSING_PHOTO_LOCATION_NOTE;
}

export type PhotoFieldSource = "camera" | "library";

/**
 * Copper note after a photo is chosen. Camera-roll uses EXIF only. Live Camera
 * also counts the device clock and allowed/live GPS already on the form — do
 * not claim those fields are missing when the live path supplied them.
 */
export function missingPhotoFieldsNote(args: {
  source: PhotoFieldSource;
  exifHasDateTime: boolean;
  exifHasLocation: boolean;
  /** Live Camera: device clock already on the form, or stamped at capture. */
  liveHasDateTime?: boolean;
  /** Live Camera: sign-in / live GPS, photo GPS, or a pin already on the form. */
  liveHasLocation?: boolean;
  /** Live Camera: GPS still resolving or allowed location is incoming. */
  locationPending?: boolean;
}): string | null {
  if (args.source === "library") {
    return missingPhotoExifNote({
      hasDateTime: args.exifHasDateTime,
      hasLocation: args.exifHasLocation,
    });
  }
  const hasDateTime = args.exifHasDateTime || Boolean(args.liveHasDateTime);
  const hasLocation = args.exifHasLocation || Boolean(args.liveHasLocation);
  if (args.locationPending) {
    if (hasDateTime) return null;
    return MISSING_PHOTO_DATETIME_NOTE;
  }
  return missingPhotoExifNote({ hasDateTime, hasLocation });
}
