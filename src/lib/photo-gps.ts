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
