import type { CatchRecord } from "./types";

const PHOTO_EXT = /\.(jpe?g|png|webp|gif|svg)(?:\?|#|$)/i;

export function photoSrc(photoPath: string | null): string | null {
  if (!photoPath) return null;
  if (photoPath.startsWith("/seed/") || photoPath.startsWith("http") || photoPath.startsWith("blob:")) {
    return photoPath;
  }
  return `/api/media/${encodeURIComponent(photoPath)}`;
}

/** Logged camera/roll uploads only — never seed art, stock, or remote placeholders. */
export function isPersonalPhoto(photoPath: string | null): boolean {
  if (!photoPath) return false;
  const path = photoPath.trim();
  if (!path) return false;
  if (path.startsWith("/seed/")) return false;
  if (/unsplash|placeholder|stock|lorem|picsum/i.test(path)) return false;
  if (path.startsWith("http://") || path.startsWith("https://")) return false;
  return true;
}

export function personalPhotoSrc(photoPath: string | null): string | null {
  return isPersonalPhoto(photoPath) ? photoSrc(photoPath) : null;
}

export function extensionFromPath(photoPath: string | null | undefined): string {
  if (!photoPath) return "jpg";
  const match = photoPath.toLowerCase().match(PHOTO_EXT);
  if (!match) return "jpg";
  return match[1] === "jpeg" ? "jpg" : match[1];
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Sensible camera-roll filename: catch-compass-{species}-{YYYY-MM-DD}.jpg */
export function catchPhotoFilename(args: {
  species?: string | string[] | null;
  caughtAt?: string | null;
  photoPath?: string | null;
}): string {
  const names = Array.isArray(args.species)
    ? args.species.filter(Boolean)
    : args.species
      ? [args.species]
      : [];
  const speciesSlug = slugPart(names.slice(0, 2).join("-")) || "catch";
  const date = (args.caughtAt ?? "").slice(0, 10);
  const dateSlug = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "photo";
  return `catch-compass-${speciesSlug}-${dateSlug}.${extensionFromPath(args.photoPath)}`;
}

export function weatherLine(
  record: Pick<
    CatchRecord,
    "temperatureF" | "weatherCondition" | "windSpeedMph" | "windDirection"
  >,
): string {
  const bits: string[] = [];
  if (record.temperatureF != null) bits.push(`${Math.round(record.temperatureF)}°F`);
  if (record.weatherCondition) bits.push(record.weatherCondition.replace("-", " "));
  if (record.windSpeedMph != null && record.windDirection) {
    bits.push(`${record.windDirection} ${Math.round(record.windSpeedMph)} mph`);
  } else if (record.windSpeedMph != null) {
    bits.push(`${Math.round(record.windSpeedMph)} mph wind`);
  } else if (record.windDirection) {
    bits.push(`${record.windDirection} wind`);
  }
  return bits.join(" · ") || "Weather not logged";
}

export async function compressImage(file: File, maxDim = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.86),
  );
  return blob ?? file;
}
