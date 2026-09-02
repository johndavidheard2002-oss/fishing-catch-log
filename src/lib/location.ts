/** Photo GPS is often the cooler, dock, or truck — not the water. */

export type PinSource = "photo" | "device" | "manual";

export function shouldApplyPhotoGpsToCatch(catchLocationLocked: boolean): boolean {
  return !catchLocationLocked;
}

export function catchPinFromPhotoGps(args: {
  photoLat: number | null | undefined;
  photoLon: number | null | undefined;
  catchLat?: string | null;
  catchLon?: string | null;
  catchLocationLocked: boolean;
}): { latitude: string; longitude: string } | null {
  if (args.catchLocationLocked) return null;
  if (args.photoLat == null || args.photoLon == null) return null;
  if (args.catchLat?.trim() && args.catchLon?.trim()) return null;
  return { latitude: String(args.photoLat), longitude: String(args.photoLon) };
}

export function coordsLookDifferent(
  aLat: number | null | undefined,
  aLon: number | null | undefined,
  bLat: number | null | undefined,
  bLon: number | null | undefined,
  epsilon = 0.0008,
): boolean {
  if (aLat == null || aLon == null || bLat == null || bLon == null) return false;
  return Math.abs(aLat - bLat) > epsilon || Math.abs(aLon - bLon) > epsilon;
}

export function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}
