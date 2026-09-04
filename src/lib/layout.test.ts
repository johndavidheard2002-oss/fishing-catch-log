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
  });
});
