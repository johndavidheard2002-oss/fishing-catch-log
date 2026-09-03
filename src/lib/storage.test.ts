import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureUploadsDir, isHttpPhotoPath, readUploadedPhoto, saveUploadedPhoto, uploadsDir } from "./storage";

describe("uploads storage", () => {
  const previous = process.env.UPLOADS_DIR;
  const tmpDirs: string[] = [];

  afterEach(() => {
    if (previous === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previous;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  it("defaults under data/uploads and honors UPLOADS_DIR", () => {
    delete process.env.UPLOADS_DIR;
    expect(uploadsDir()).toBe(path.join(process.cwd(), "data", "uploads"));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-up-"));
    tmpDirs.push(dir);
    process.env.UPLOADS_DIR = dir;
    expect(uploadsDir()).toBe(path.resolve(dir));
    expect(ensureUploadsDir()).toBe(path.resolve(dir));
  });

  it("writes a photo to disk and reads it back", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-up-"));
    tmpDirs.push(dir);
    process.env.UPLOADS_DIR = dir;
    const file = new File([Uint8Array.from([1, 2, 3, 4])], "shot.jpg", { type: "image/jpeg" });
    const { photoPath } = await saveUploadedPhoto(file);
    expect(photoPath.endsWith(".jpg")).toBe(true);
    const buf = readUploadedPhoto(photoPath);
    expect(buf?.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
  });

  it("treats http(s) photo_path as a reachable URL, not a local file", () => {
    expect(isHttpPhotoPath("https://bucket.example/catch.jpg")).toBe(true);
    expect(isHttpPhotoPath("catch.jpg")).toBe(false);
  });
});
