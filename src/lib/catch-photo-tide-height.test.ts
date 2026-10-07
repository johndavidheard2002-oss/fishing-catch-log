import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const catchCard = readFileSync(resolve(__dirname, "../components/CatchCard.tsx"), "utf8");
const badge = readFileSync(resolve(__dirname, "../components/PhotoTideHeightBadge.tsx"), "utf8");
const history = readFileSync(resolve(__dirname, "../components/HistoryClient.tsx"), "utf8");
const tides = readFileSync(resolve(__dirname, "./plan-tides.ts"), "utf8");

describe("Calendar Log catch photo tide height", () => {
  it("reuses Plan's compact height formatter on list and grid thumbs", () => {
    expect(catchCard).toContain("CatchPhotoTideHeightBadge");
    expect(catchCard.match(/<CatchPhotoTideHeightBadge record=\{record\} \/>/g)).toHaveLength(2);
    expect(catchCard).not.toContain(".toFixed(");
    expect(catchCard).not.toContain("formatCatchTideHeightFt");

    expect(badge).toContain("catchRecordTideHeightLabel");
    expect(badge).toContain("catchTideLookupKey");
    expect(badge).toContain("pinFromTideRecord");
    expect(badge).toContain("/api/assist/weather");
    expect(badge).toContain('data-testid="calendar-catch-photo-tide-height"');
    expect(badge).toContain("PHOTO_TIDE_HEIGHT_BADGE_CLASS");
    expect(badge).toContain("right-0.5 bottom-0.5");
    expect(badge).toContain("bg-ink/80");
    expect(badge).not.toContain(".toFixed(");

    expect(tides).toContain("formatCatchTideHeightFt");
    expect(tides).toContain("catchLoggedOrSampledHeight");
    expect(tides).toContain("catchRecordTideHeightLabel");

    expect(history).toContain("<CatchCard");
    expect(history).toContain("<CatchGridCard");
    expect(history).toContain('layout={view === "grid" ? "grid" : "list"}');
    expect(history).toContain("calendar-log-own-feed");
    expect(history).toContain("calendar-log-shared-feed");
  });
});
