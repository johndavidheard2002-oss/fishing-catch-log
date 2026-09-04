import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("phone-width Log and Backfill", () => {
  it("keeps photo cards and Find fish photos inside the viewport", () => {
    const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");
    expect(css).toMatch(/\.journal-card \{[\s\S]*?max-width: 100%/);
    expect(css).toMatch(/\.page-intro \{[\s\S]*?max-width: 100%/);
    const photo = readFileSync(resolve(__dirname, "../components/PhotoCapture.tsx"), "utf8");
    expect(photo).toContain("max-w-full");
    expect(photo).toContain("min-w-0");
    const backfill = readFileSync(resolve(__dirname, "../components/BackfillClient.tsx"), "utf8");
    expect(backfill).toContain("max-w-full");
    expect(backfill).toContain("Find fish photos");
    const log = readFileSync(resolve(__dirname, "../components/LogClient.tsx"), "utf8");
    expect(log).toContain("max-w-full");
    const form = readFileSync(resolve(__dirname, "../components/CatchForm.tsx"), "utf8");
    expect(form).toContain("min-w-0 max-w-full");
    const shell = readFileSync(resolve(__dirname, "../components/AppShell.tsx"), "utf8");
    expect(shell).toContain("app-shell");
    expect(shell).toContain("min-w-0");
    expect(css).toMatch(/\.app-shell \{[\s\S]*?overflow-x: hidden/);
    const wordmark = readFileSync(resolve(__dirname, "../components/BrandWordmark.tsx"), "utf8");
    expect(wordmark).toContain("text-[1.35rem]");
  });

  it("puts the dark navy logo-corner trout wash on the Home Tide Mark lockup, not the thin header", () => {
    const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");
    const homeBlock = css.match(/\.home-lockup \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(homeBlock).toContain('url("/brand/logo-trout-wash-bg.png")');
    expect(homeBlock).not.toContain("soft-trout-wash-bg.png");
    expect(homeBlock).toContain("color: #f4f0e4");
    expect(homeBlock).toMatch(/text-shadow:\s*\n\s*0 1px 2px rgb\(0 0 0 \/ 0\.92\)/);
    expect(css).toMatch(/\.journal-card \{[\s\S]*?background: rgb\(247 252 255 \/ 0\.97\)/);
    expect(css).toMatch(/\.page-intro \{[\s\S]*?background: rgb\(247 252 255 \/ 0\.97\)/);
    expect(css).toMatch(/\.trout-wash-bg \{[\s\S]*?url\("\/brand\/dark-copper-redfish-bg\.png"\)/);
    expect(css).toMatch(/\.bottom-nav \{[\s\S]*?url\("\/brand\/soft-trout-wash-bg\.png"\)/);
    expect(css).not.toMatch(/\.signin-brand-banner \{/);
    const shell = readFileSync(resolve(__dirname, "../components/AppShell.tsx"), "utf8");
    expect(shell).toContain('className="journal-card mb-4 flex w-full min-w-0 items-center');
    expect(shell).not.toContain("signin-brand-banner");
    const home = readFileSync(resolve(__dirname, "../components/HomeClient.tsx"), "utf8");
    expect(home).toContain("page-intro home-lockup");
    expect(home).toContain('data-testid="home-lockup"');
    const wash = readFileSync(resolve(process.cwd(), "public/brand/logo-trout-wash-bg.png"));
    expect(wash.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  });

  it("uses a high-contrast teal bottom nav with white labels", () => {
    const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");
    expect(css).toMatch(/\.bottom-nav \{[\s\S]*?background-color: #0a4e6a/);
    expect(css).toMatch(/\.bottom-nav \{[\s\S]*?background-image: none/);
    expect(css).toMatch(/\.bottom-nav \{[\s\S]*?padding-bottom: max\(0\.5rem, env\(safe-area-inset-bottom\)\)/);
    expect(css).not.toMatch(/\.bottom-nav \{[\s\S]*?soft-trout-wash-bg\.png/);
    expect(css).toMatch(/\.bottom-nav a \{[\s\S]*?color: #fff/);
    expect(css).toMatch(/\.bottom-nav a\.nav-idle \{[\s\S]*?color: #f4fbff/);
    expect(css).toMatch(/\.bottom-nav a\.nav-active \.nav-icon \{[\s\S]*?background: #fff/);
    expect(css).toMatch(/\.bottom-nav a\.nav-active \.nav-icon \{[\s\S]*?color: #0a4e6a/);
    expect(css).toMatch(/\.bottom-nav a\.nav-primary \.nav-icon \{[\s\S]*?background: var\(--copper\)/);
    expect(css).toMatch(/\.bottom-nav a\.nav-primary \.nav-icon \{[\s\S]*?0 0 0 2px #fff/);
    const shell = readFileSync(resolve(__dirname, "../components/AppShell.tsx"), "utf8");
    expect(shell).toContain("bottom-nav");
    expect(shell).toContain("grid-cols-6");
    expect(shell).toContain("nav-primary");
  });
});
