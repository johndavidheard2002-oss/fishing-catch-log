import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { APP_DISPLAY_NAME, APP_LOGO_SRC, APP_SUBTITLE } from "@/lib/brand";
import {
  APPLE_STARTUP_IMAGES,
  PWA_APPLE_TOUCH_ICON,
  PWA_BACKGROUND_COLOR,
  PWA_CACHE_NAME,
  PWA_ICON_192,
  PWA_ICON_512,
  PWA_THEME_COLOR,
  appleStartupImageMetadata,
  appleStartupImagePath,
  isPwaApiPath,
  isPwaStaticAssetPath,
} from "@/lib/pwa";

describe("PWA install metadata", () => {
  it("uses standalone display and the Tide Mark icons", () => {
    const web = manifest();
    expect(APP_DISPLAY_NAME).toBe("Tide Mark");
    expect(APP_SUBTITLE).toBe("Private saltwater logbook");
    expect(APP_SUBTITLE.toLowerCase()).not.toContain("personal");
    expect(web.name).toBe("Tide Mark");
    expect(web.short_name).toBe("Tide Mark");
    expect(web.display).toBe("standalone");
    expect(web.start_url).toBe("/");
    expect(web.scope).toBe("/");
    expect(web.theme_color).toBe(PWA_THEME_COLOR);
    expect(web.background_color).toBe(PWA_BACKGROUND_COLOR);
    expect(web.icons?.map((icon) => icon.src)).toEqual([PWA_ICON_192, PWA_ICON_512]);
    expect(PWA_APPLE_TOUCH_ICON).toBe("/apple-icon.png");
    expect(APP_LOGO_SRC).toBe("/brand/tide-mark-logo.png");
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    for (const rel of [APP_LOGO_SRC, PWA_ICON_192, PWA_ICON_512, PWA_APPLE_TOUCH_ICON]) {
      const file = resolve(process.cwd(), "public", rel.slice(1));
      expect(readFileSync(file).subarray(0, 8).equals(png)).toBe(true);
    }
  });

  it("lists iPhone splash images generated from the Tide Mark logo", () => {
    const images = appleStartupImageMetadata();
    expect(images.length).toBe(APPLE_STARTUP_IMAGES.length);
    expect(images[0]).toEqual({
      url: appleStartupImagePath(750, 1334),
      media:
        "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
    });
    for (const spec of APPLE_STARTUP_IMAGES) {
      const file = resolve(process.cwd(), "public", appleStartupImagePath(spec.width, spec.height).slice(1));
      expect(readFileSync(file).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    }
  });
});

describe("PWA cache rules", () => {
  it("never treats API, media, or HTML routes as cacheable assets", () => {
    expect(isPwaApiPath("/api/catches")).toBe(true);
    expect(isPwaApiPath("/api/media/photo.jpg")).toBe(true);
    expect(isPwaApiPath("/api/auth/login")).toBe(true);
    expect(isPwaStaticAssetPath("/api/media/photo.jpg")).toBe(false);
    expect(isPwaStaticAssetPath("/")).toBe(false);
    expect(isPwaStaticAssetPath("/calendar")).toBe(false);
    expect(isPwaStaticAssetPath("/sw.js")).toBe(false);
    expect(isPwaStaticAssetPath("/_next/static/chunks/app.js")).toBe(true);
    expect(isPwaStaticAssetPath("/brand/tide-mark-logo.png")).toBe(true);
    expect(isPwaStaticAssetPath("/icon-192.png")).toBe(true);
  });

  it("keeps the service worker network-first for HTML and API", () => {
    const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(PWA_CACHE_NAME).toBe("tide-mark-static-v3");
    expect(sw).toContain(`"${PWA_CACHE_NAME}"`);
    expect(sw).not.toContain("catch-compass-static");
    expect(sw).toContain("skipWaiting");
    expect(sw).toContain("clients.claim");
    expect(sw).toMatch(/caches\.delete/);
    expect(sw).not.toMatch(/cache\.addAll/);
    expect(sw).toMatch(/pathname\.startsWith\("\/api\/"\)/);
    expect(sw).toMatch(/request\.mode === "navigate"/);
    expect(sw).toMatch(/_next\/static/);
  });
});
