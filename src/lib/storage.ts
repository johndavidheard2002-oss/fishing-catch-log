import fs from "node:fs";
import path from "node:path";

/** Catch/bait photos. Local disk on this host — works with file SQLite and with Turso. */
export function uploadsDir(): string {
  const override = process.env.UPLOADS_DIR?.trim();
  if (override) return path.resolve(/*turbopackIgnore: true*/ override);
  return path.join(process.cwd(), "data", "uploads");
}

export function ensureUploadsDir(): string {
  const dir = uploadsDir();
  fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  return dir;
}

export function isHttpPhotoPath(photoPath: string | null | undefined): boolean {
  const value = photoPath?.trim() ?? "";
  return value.startsWith("http://") || value.startsWith("https://");
}

export async function saveUploadedPhoto(file: File): Promise<{ photoPath: string }> {
  const mime = file.type || "image/jpeg";
  const ext =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const dest = path.join(/*turbopackIgnore: true*/ ensureUploadsDir(), filename);
  fs.writeFileSync(/*turbopackIgnore: true*/ dest, Buffer.from(await file.arrayBuffer()));
  return { photoPath: filename };
}

export function readUploadedPhoto(filename: string): Buffer | null {
  const safe = path.basename(filename);
  const filePath = path.join(/*turbopackIgnore: true*/ uploadsDir(), safe);
  if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) return null;
  return fs.readFileSync(/*turbopackIgnore: true*/ filePath);
}
