import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { baitOf } from "./testing";
import { baitGroupThumbSrc, baitRecordThumbSrc } from "./spot-thumbs";
import { personalPhotoSrc } from "./photo";

const baitCard = readFileSync(resolve(__dirname, "../components/BaitSpotCard.tsx"), "utf8");
const baitDetail = readFileSync(resolve(__dirname, "../components/BaitSpotDetail.tsx"), "utf8");
const baitForm = readFileSync(resolve(__dirname, "../components/BaitSpotForm.tsx"), "utf8");
const photoCapture = readFileSync(resolve(__dirname, "../components/PhotoCapture.tsx"), "utf8");
const optionThumb = readFileSync(resolve(__dirname, "../components/OptionThumb.tsx"), "utf8");
const plan = readFileSync(resolve(__dirname, "../components/PlanClient.tsx"), "utf8");
const spots = readFileSync(resolve(__dirname, "../components/SpotsClient.tsx"), "utf8");
const dayShare = readFileSync(resolve(__dirname, "../components/DayShareSpots.tsx"), "utf8");

describe("bait photos only when logged", () => {
  it("helpers return no src when photoPath is missing or not a personal upload", () => {
    expect(personalPhotoSrc(null)).toBeNull();
    expect(baitRecordThumbSrc(baitOf({ id: "no-photo" }))).toBeNull();
    expect(baitRecordThumbSrc(baitOf({ id: "logged", photoPath: "mullet.jpg" }))).toBe(
      "/api/media/mullet.jpg",
    );
    expect(
      baitGroupThumbSrc({
        key: "g",
        placeName: "Canal",
        latitude: 28.7,
        longitude: -80.7,
        visitCount: 1,
        baitTypes: ["Shrimp"],
        lastLoggedAt: "2026-08-02T14:00:00.000Z",
        typicalCondition: null,
        typicalTime: null,
        avgTempF: null,
        spots: [baitOf({ id: "empty-group" })],
      }),
    ).toBeNull();
  });

  it("omits the empty photo well on bait cards and grid cards", () => {
    expect(baitCard).toContain("personalPhotoSrc(spot.photoPath)");
    expect(baitCard).toContain('data-testid="bait-photo"');
    expect(baitCard).toContain("{src ? (");
    expect(baitCard).not.toMatch(/items-center justify-center[\s\S]{0,160}Bait/);
    expect(baitCard).not.toContain("uppercase tracking-wide text-copper");
    expect(baitCard).not.toContain("No photo");
  });

  it("renders bait detail photo only when a personal src exists", () => {
    expect(baitDetail).toContain("personalPhotoSrc(record.photoPath)");
    expect(baitDetail).toContain("{src ? (");
    expect(baitDetail).toContain('data-testid="bait-photo"');
    expect(baitDetail).not.toContain("photo-capture-brand");
    expect(baitDetail).not.toMatch(/src \? \([\s\S]*\) : \(\s*<div/);
  });

  it("hides the brand/camera well on the bait form until a photo is added", () => {
    expect(baitForm).toContain("hideEmptyWell");
    expect(baitForm).toContain("personalPhotoSrc(initial.photoPath)");
    expect(photoCapture).toContain("hideEmptyWell");
    expect(photoCapture).toContain("showWell");
    expect(photoCapture).toContain('data-testid="photo-optional"');
    expect(photoCapture).toContain("Boolean(previewUrl) || !hideEmptyWell");
  });

  it("does not draw a bait silhouette thumb when the spots list has no photo", () => {
    expect(optionThumb).toContain('if (!src && kind === "bait") return null');
    expect(optionThumb).not.toContain("BaitMark");
    expect(optionThumb).toContain("FishMark");
    expect(spots).toContain("baitGroupThumbSrc");
    expect(spots).toContain("baitRecordThumbSrc");
    expect(spots).toContain('<span className="text-xs font-semibold text-teal">Map</span>');
  });

  it("keeps Plan and share rows text-only when bait has no photo", () => {
    expect(plan).toContain("personalPhotoSrc(first.photoPath)");
    expect(plan).toContain("personalPhotoSrc(m.baitSpot.photoPath)");
    expect(plan).toContain("{src ? (");
    expect(plan).toContain("{baitSrc ? (");
    expect(plan).not.toMatch(/plan-bait-photo[\s\S]{0,200}Bait/);
    expect(plan).not.toMatch(/text-ink-muted">\s*Bait\s*</);
    expect(dayShare).toContain('row.kind === "bait" ? null');
    expect(dayShare).not.toContain('row.kind === "bait" ? "Bait"');
  });
});
