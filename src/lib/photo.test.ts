import { describe, expect, it } from "vitest";
import { isPersonalPhoto, personalPhotoSrc, photoSrc } from "./photo";

describe("isPersonalPhoto", () => {
  it("accepts uploaded journal files only", () => {
    expect(isPersonalPhoto("abc123.jpg")).toBe(true);
    expect(isPersonalPhoto("/seed/largemouth.svg")).toBe(false);
    expect(isPersonalPhoto("https://images.unsplash.com/photo")).toBe(false);
    expect(isPersonalPhoto(null)).toBe(false);
  });
});

describe("personalPhotoSrc", () => {
  it("does not surface seed or stock art", () => {
    expect(personalPhotoSrc("/seed/mahi.svg")).toBeNull();
    expect(photoSrc("/seed/mahi.svg")).toBe("/seed/mahi.svg");
    expect(personalPhotoSrc("trip.jpg")).toBe("/api/media/trip.jpg");
  });
});
