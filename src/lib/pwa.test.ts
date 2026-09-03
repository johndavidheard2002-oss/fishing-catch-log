import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { APP_DISPLAY_NAME, APP_LOGO_SRC } from "@/lib/brand";
import {
  APPLE_STARTUP_IMAGES,
  PWA_APPLE_TOUCH_ICON,
  PWA_BACKGROUND_COLOR,
  PWA_ICON_192,
  PWA_ICON_512,
  PWA_THEME_COLOR,
  appleStartupImageMetadata,
  appleStartupImagePath,
  isPwaApiPath,
  isPwaStaticAssetPath,
} from "@/lib/pwa";

describe("PWA install metadata", () => {
  it("uses standalone display and the existing Catch Compass icons", () => {
    const web = manifest();
    expect(web.name).toBe(APP_DISPLAY_NAME);
    expect(web.short_name).toBe(APP_DISPLAY_NAME);
    expect(web.display).toBe("standalone");
    expect(web.start_url).toBe("/");
    expect(web.scope).toBe("/");
    expect(web.theme_color).toBe(PWA_THEME_COLOR);
    expect(web.background_color).toBe(PWA_BACKGROUND_COLOR);
    expect(web.icons?.map((icon) => icon.src)).toEqual([PWA_ICON_192, PWA_ICON_512]);
    expect(PWA_APPLE_TOUCH_ICON).toBe("/apple-icon.png");
    expect(APP_LOGO_SRC).toBe("/brand/catch-compass-logo.png");
  });

  it("lists iPhone splash images generated from the existing logo", () => {
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
    expect(isPwaStaticAssetPath("/brand/catch-compass-logo.png")).toBe(true);
    expect(isPwaStaticAssetPath("/icon-192.png")).toBe(true);
  });

  it("keeps the service worker network-first for HTML and API", () => {
    const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain("catch-compass-static-");
    expect(sw).not.toMatch(/cache\.addAll/);
    expect(sw).toMatch(/pathname\.startsWith\("\/api\/"\)/);
    expect(sw).toMatch(/request\.mode === "navigate"/);
    expect(sw).toMatch(/_next\/static/);
  });
});
