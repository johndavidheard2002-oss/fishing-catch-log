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

  it("puts logo trout wash only on the sign-in Tide Mark banner", () => {
    const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");
    expect(css).toMatch(
      /\.signin-brand-banner \{[\s\S]*?url\("\/brand\/logo-trout-wash-bg\.png"\)/,
    );
    expect(css).toMatch(/\.journal-card \{[\s\S]*?background: rgb\(247 252 255 \/ 0\.97\)/);
    expect(css).toMatch(/\.trout-wash-bg \{[\s\S]*?url\("\/brand\/dark-copper-redfish-bg\.png"\)/);
    const shell = readFileSync(resolve(__dirname, "../components/AppShell.tsx"), "utf8");
    expect(shell).toContain('onSignIn ? "signin-brand-banner" : "journal-card"');
    expect(shell).toContain('data-testid={onSignIn ? "signin-brand-banner"');
    const wash = readFileSync(resolve(process.cwd(), "public/brand/logo-trout-wash-bg.png"));
    expect(wash.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  });
});
