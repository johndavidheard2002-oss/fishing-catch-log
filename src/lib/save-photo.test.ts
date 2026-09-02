import { describe, expect, it } from "vitest";
import { savePhotoHint } from "./save-photo";

describe("savePhotoHint", () => {
  it("explains the share sheet and download fallbacks", () => {
    expect(savePhotoHint("shared")).toMatch(/Save Image|Add to Photos/i);
    expect(savePhotoHint("downloaded")).toMatch(/Downloads|Photos/i);
    expect(savePhotoHint("opened")).toMatch(/Long-press/i);
    expect(savePhotoHint("cancelled")).toBeNull();
  });
});
