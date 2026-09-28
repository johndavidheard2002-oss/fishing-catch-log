import { eq, inArray, or } from "drizzle-orm";
import { isPersonalPhoto } from "../photo";
import { deleteUploadedPhotoFile } from "../storage";
import { ensureDb } from "./index";
import { allRows, runChange } from "./query";
import { anglers, baitSpots, buddyLinks, calendarNotes, catches, namedAreas, spotShares } from "./schema";

function personalPhotoPaths(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const value of values) {
    const path = value?.trim() ?? "";
    if (!path || !isPersonalPhoto(path) || out.includes(path)) continue;
    out.push(path);
  }
  return out;
}

/**
 * Permanently remove one journal. Friend-owned catches, photos, and notes stay.
 * Photos still referenced by someone else are left on disk.
 */
export async function deleteAnglerAccount(anglerId: string): Promise<boolean> {
  const db = await ensureDb();
  const catchPhotos = await allRows(
    db.select({ photoPath: catches.photoPath }).from(catches).where(eq(catches.anglerId, anglerId)),
  );
  const baitPhotos = await allRows(
    db.select({ photoPath: baitSpots.photoPath }).from(baitSpots).where(eq(baitSpots.anglerId, anglerId)),
  );
  const notePhotos = await allRows(
    db.select({ photoPath: calendarNotes.photoPath }).from(calendarNotes).where(eq(calendarNotes.anglerId, anglerId)),
  );
  const photos = personalPhotoPaths([
    ...catchPhotos.map((row) => row.photoPath),
    ...baitPhotos.map((row) => row.photoPath),
    ...notePhotos.map((row) => row.photoPath),
  ]);

  await runChange(
    db.delete(spotShares).where(or(eq(spotShares.ownerId, anglerId), eq(spotShares.buddyId, anglerId))),
  );
  await runChange(
    db.delete(buddyLinks).where(or(eq(buddyLinks.anglerId, anglerId), eq(buddyLinks.buddyId, anglerId))),
  );
  await runChange(db.delete(calendarNotes).where(eq(calendarNotes.anglerId, anglerId)));
  await runChange(db.delete(namedAreas).where(eq(namedAreas.anglerId, anglerId)));
  await runChange(db.delete(baitSpots).where(eq(baitSpots.anglerId, anglerId)));
  await runChange(db.delete(catches).where(eq(catches.anglerId, anglerId)));
  const removed = await runChange(db.delete(anglers).where(eq(anglers.id, anglerId)));
  if (removed < 1) return false;

  if (photos.length) {
    const still = new Set<string>();
    const leftoverCatches = await allRows(
      db.select({ photoPath: catches.photoPath }).from(catches).where(inArray(catches.photoPath, photos)),
    );
    const leftoverBait = await allRows(
      db.select({ photoPath: baitSpots.photoPath }).from(baitSpots).where(inArray(baitSpots.photoPath, photos)),
    );
    const leftoverNotes = await allRows(
      db
        .select({ photoPath: calendarNotes.photoPath })
        .from(calendarNotes)
        .where(inArray(calendarNotes.photoPath, photos)),
    );
    for (const row of [...leftoverCatches, ...leftoverBait, ...leftoverNotes]) {
      if (row.photoPath) still.add(row.photoPath);
    }
    for (const photo of photos) {
      if (still.has(photo)) continue;
      deleteUploadedPhotoFile(photo);
    }
  }
  return true;
}
