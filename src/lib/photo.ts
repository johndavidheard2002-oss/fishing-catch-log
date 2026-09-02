import type { CatchRecord } from "./types";

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

export function weatherLine(record: Pick<CatchRecord, "temperatureF" | "weatherCondition" | "windSpeedMph">): string {
  const bits: string[] = [];
  if (record.temperatureF != null) bits.push(`${Math.round(record.temperatureF)}°F`);
  if (record.weatherCondition) bits.push(record.weatherCondition.replace("-", " "));
  if (record.windSpeedMph != null) bits.push(`${Math.round(record.windSpeedMph)} mph wind`);
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
