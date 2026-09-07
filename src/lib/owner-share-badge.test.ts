import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const badge = readFileSync(resolve(__dirname, "../components/OwnerShareBadge.tsx"), "utf8");
const catchCard = readFileSync(resolve(__dirname, "../components/CatchCard.tsx"), "utf8");
const baitCard = readFileSync(resolve(__dirname, "../components/BaitSpotCard.tsx"), "utf8");
const history = readFileSync(resolve(__dirname, "../components/HistoryClient.tsx"), "utf8");

describe("owner share badge on Calendar List photos", () => {
  it("is a compact top-right overlay that stays readable on a photo", () => {
    expect(badge).toContain('data-testid="owner-share-badge"');
    expect(badge).toContain("ownerShareBadgeLabel");
    expect(badge).toContain("bg-teal/90");
    expect(badge).toContain("bg-ink/70");
    expect(badge).toContain("text-white");
    expect(badge).toMatch(/right-/);
    expect(badge).toMatch(/top-/);
    expect(badge).toContain("truncate");
    expect(badge).toContain("max-w-");
  });

  it("marks the owner’s own List catch and bait photos, not friends’ Shared cards", () => {
    expect(catchCard).toContain("OwnerShareBadge");
    expect(catchCard).toContain("theirs ? (");
    expect(catchCard).toContain("<SharedOwnerBadge name={record.ownerName} compact={compact} />");
    expect(catchCard).toContain("sharedWithBuddyIds={record.sharedWithBuddyIds}");
    expect(catchCard).not.toMatch(/CatchGridCard[\s\S]*OwnerShareBadge/);

    expect(baitCard).toContain("OwnerShareBadge");
    expect(baitCard).toContain("<SharedOwnerBadge name={spot.ownerName} compact={compact} />");
    expect(baitCard).toContain("sharedWithBuddyIds={spot.sharedWithBuddyIds}");
    expect(baitCard).not.toMatch(/BaitSpotGridCard[\s\S]*OwnerShareBadge/);

    expect(history).toContain('view === "shared"');
    expect(history).toContain("calendar-log-shared-feed");
    expect(history).toContain("calendar-log-own-feed");
  });
});
