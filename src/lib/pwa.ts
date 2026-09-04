/** Home-screen / splash colors — match the Tide Mark copper seal. */
export const PWA_THEME_COLOR = "#040a13";
export const PWA_BACKGROUND_COLOR = "#040a13";

export const PWA_ICON_192 = "/icon-192.png";
export const PWA_ICON_512 = "/icon-512.png";
export const PWA_APPLE_TOUCH_ICON = "/apple-icon.png";

/**
 * iPhone portrait startup images (CSS points × pixel ratio).
 * Files are generated from the Tide Mark logo.
 */
export const APPLE_STARTUP_IMAGES = [
  { width: 750, height: 1334, deviceWidth: 375, deviceHeight: 667, ratio: 2 },
  { width: 828, height: 1792, deviceWidth: 414, deviceHeight: 896, ratio: 2 },
  { width: 1125, height: 2436, deviceWidth: 375, deviceHeight: 812, ratio: 3 },
  { width: 1170, height: 2532, deviceWidth: 390, deviceHeight: 844, ratio: 3 },
  { width: 1179, height: 2556, deviceWidth: 393, deviceHeight: 852, ratio: 3 },
  { width: 1206, height: 2622, deviceWidth: 402, deviceHeight: 874, ratio: 3 },
  { width: 1284, height: 2778, deviceWidth: 428, deviceHeight: 926, ratio: 3 },
  { width: 1290, height: 2796, deviceWidth: 430, deviceHeight: 932, ratio: 3 },
  { width: 1320, height: 2868, deviceWidth: 440, deviceHeight: 956, ratio: 3 },
] as const;

export function appleStartupImagePath(width: number, height: number) {
  return `/splash/apple-splash-${width}x${height}.png`;
}

export function appleStartupImageMedia(spec: (typeof APPLE_STARTUP_IMAGES)[number]) {
  return `(device-width: ${spec.deviceWidth}px) and (device-height: ${spec.deviceHeight}px) and (-webkit-device-pixel-ratio: ${spec.ratio}) and (orientation: portrait)`;
}

export function appleStartupImageMetadata() {
  return APPLE_STARTUP_IMAGES.map((spec) => ({
    url: appleStartupImagePath(spec.width, spec.height),
    media: appleStartupImageMedia(spec),
  }));
}

/** Bump this (and public/sw.js) so leftover home-screen SW caches drop. */
export const PWA_CACHE_NAME = "tide-mark-static-v1";

/** Paths the service worker must never intercept (photos, auth, Turso APIs). */
export function isPwaApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/** Hashed and brand files the service worker may cache. HTML and API stay network-only. */
export function isPwaStaticAssetPath(pathname: string) {
  if (isPwaApiPath(pathname)) return false;
  if (pathname === "/sw.js") return false;
  if (pathname.startsWith("/_next/static/")) return true;
  if (pathname.startsWith("/brand/")) return true;
  if (pathname.startsWith("/splash/")) return true;
  if (pathname.startsWith("/seed/")) return true;
  return /\.(png|jpe?g|svg|ico|webp|woff2?)$/i.test(pathname);
}
