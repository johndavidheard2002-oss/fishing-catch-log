import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const badge = readFileSync(resolve(__dirname, "../components/SharedOwnerBadge.tsx"), "utf8");
const catchCard = readFileSync(resolve(__dirname, "../components/CatchCard.tsx"), "utf8");
const baitCard = readFileSync(resolve(__dirname, "../components/BaitSpotCard.tsx"), "utf8");

describe("shared friend name on photos", () => {
  it("uses a high-contrast copper pill so the name reads on a bright photo", () => {
    expect(badge).toContain('data-testid="shared-owner-badge"');
    expect(badge).toContain("bg-copper");
    expect(badge).toContain("text-white");
    expect(badge).toContain("absolute");
    expect(badge).toMatch(/bottom-/);
    expect(badge).toContain("Shared by");
    expect(badge).not.toMatch(/buddy/i);
  });

  it("overlays CatchCard and CatchGridCard photos and drops the text-area chip", () => {
    expect(catchCard).toContain("SharedOwnerBadge");
    expect(catchCard).toContain("record.ownerName");
    expect(catchCard).toContain("theirs ? <SharedOwnerBadge name={record.ownerName}");
    expect(catchCard.match(/ownerName/g)).toHaveLength(2);
    expect(catchCard).not.toContain("bg-copper/15");
    expect(catchCard).toContain("relative aspect-square");
  });

  it("overlays BaitSpotCard and BaitSpotGridCard photos the same way", () => {
    expect(baitCard).toContain("SharedOwnerBadge");
    expect(baitCard).toContain("spot.ownerName");
    expect(baitCard).toContain("theirs ? <SharedOwnerBadge name={spot.ownerName}");
    expect(baitCard.match(/ownerName/g)).toHaveLength(2);
    expect(baitCard).not.toMatch(/theirs \? \(\s*<span className="rounded-full bg-copper\/15/);
  });
});
