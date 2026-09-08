import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const badge = readFileSync(resolve(__dirname, "../components/OwnerShareBadge.tsx"), "utf8");
const catchCard = readFileSync(resolve(__dirname, "../components/CatchCard.tsx"), "utf8");
const baitCard = readFileSync(resolve(__dirname, "../components/BaitSpotCard.tsx"), "utf8");
const history = readFileSync(resolve(__dirname, "../components/HistoryClient.tsx"), "utf8");
const catchDetail = readFileSync(resolve(__dirname, "../components/CatchDetail.tsx"), "utf8");
const baitDetail = readFileSync(resolve(__dirname, "../components/BaitSpotDetail.tsx"), "utf8");

const catchList = catchCard.slice(
  catchCard.indexOf("export function CatchCard"),
  catchCard.indexOf("export function CatchGridCard"),
);
const baitList = baitCard.slice(
  baitCard.indexOf("export function BaitSpotCard"),
  baitCard.indexOf("export function BaitSpotGridCard"),
);

describe("owner share badge on Calendar List rows", () => {
  it("is a compact listing-chrome pill, not a photo overlay", () => {
    expect(badge).toContain('data-testid="owner-share-badge"');
    expect(badge).toContain("ownerShareBadgeLabel");
    expect(badge).toContain("bg-teal/90");
    expect(badge).toContain("bg-ink/70");
    expect(badge).toContain("text-white");
    expect(badge).toContain("shrink-0");
    expect(badge).toContain("self-start");
    expect(badge).toContain("truncate");
    expect(badge).toContain("max-w-");
    expect(badge).not.toContain("absolute");
    expect(badge).toContain("List row chrome");
  });

  it("sits at the top right of the catch and bait listing, off the photo", () => {
    expect(catchList).toContain("OwnerShareBadge");
    expect(catchList).toContain("theirs ? (");
    expect(catchList).toContain("<SharedOwnerBadge name={record.ownerName} compact={compact} />");
    expect(catchList).toContain("sharedWithBuddyIds={record.sharedWithBuddyIds}");
    expect(catchList).toContain("flex items-start gap-2");
    expect(catchList.match(/<img[\s\S]*?<\/Link>/)?.[0] ?? "").not.toContain("OwnerShareBadge");
    expect(catchList).toMatch(/flex items-start gap-2[\s\S]*OwnerShareBadge/);
    expect(catchCard).not.toMatch(/CatchGridCard[\s\S]*OwnerShareBadge/);

    expect(baitList).toContain("OwnerShareBadge");
    expect(baitList).toContain("<SharedOwnerBadge name={spot.ownerName} compact={compact} />");
    expect(baitList).toContain("sharedWithBuddyIds={spot.sharedWithBuddyIds}");
    expect(baitList).toContain("flex items-start gap-2");
    expect(baitList.match(/data-testid="bait-photo"[\s\S]*?<\/Link>/)?.[0] ?? "").not.toContain(
      "OwnerShareBadge",
    );
    expect(baitList).toMatch(/flex items-start gap-2[\s\S]*OwnerShareBadge/);
    expect(baitCard).not.toMatch(/BaitSpotGridCard[\s\S]*OwnerShareBadge/);

    expect(history).toContain('view === "shared"');
    expect(history).toContain("calendar-log-shared-feed");
    expect(history).toContain("calendar-log-own-feed");
  });

  it("uses the same share status on catch and bait detail, including buddy ids", () => {
    expect(catchDetail).toContain("OwnerShareBadge");
    expect(catchDetail).toContain("ownerShareStatusLine");
    expect(catchDetail).toContain("sharedWithBuddyIds={record.sharedWithBuddyIds}");
    expect(catchDetail).toContain('data-testid="owner-share-status"');
    expect(catchDetail).toContain("flex items-start gap-2");
    expect(catchDetail).not.toContain("Private to you. Not shared with anyone.");
    expect(catchDetail).not.toMatch(/sharedWithLinked \? \([\s\S]*PRIVACY_LINE/);

    expect(baitDetail).toContain("OwnerShareBadge");
    expect(baitDetail).toContain("ownerShareStatusLine");
    expect(baitDetail).toContain("sharedWithBuddyIds={record.sharedWithBuddyIds}");
    expect(baitDetail).toContain('data-testid="owner-share-status"');
    expect(baitDetail).toContain("flex items-start gap-2");
    expect(baitDetail).not.toContain("Private to you. Not shared with anyone.");
    expect(baitDetail).not.toMatch(/sharedWithLinked\s*\n\s*\? `\$\{PRIVACY_LINE\}/);
  });
});
