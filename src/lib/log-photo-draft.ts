/**
 * Live Log photo draft: the IndexedDB hold is for an unsaved Camera / roll pick
 * only. After a catch is saved it must be cleared, and a late hold restore must
 * never replace a photo the angler just chose.
 */

export function shouldRestoreHeldLogPhoto(args: {
  mode: "create" | "edit";
  pastMode: boolean;
  hasInitial: boolean;
  importedPhotoPath: string | null | undefined;
  hasPhotoFile: boolean;
}): boolean {
  return (
    args.mode === "create" &&
    !args.pastMode &&
    !args.hasInitial &&
    !args.importedPhotoPath &&
    !args.hasPhotoFile
  );
}

/** Apply a held-photo restore only if nothing newer was chosen while it loaded. */
export function shouldApplyHeldLogPhoto(args: {
  cancelled: boolean;
  hasBlob: boolean;
  restoreGeneration: number;
  chosenGeneration: number;
}): boolean {
  return (
    !args.cancelled &&
    args.hasBlob &&
    args.restoreGeneration === args.chosenGeneration
  );
}

/** Online create save must drop the hold so the next Log is a blank photo well. */
export function shouldClearHeldLogPhotoAfterSave(args: {
  mode: "create" | "edit";
}): boolean {
  return args.mode === "create";
}

/**
 * John's Log screenshot: Camera roll (and a restored hold treated as a file)
 * shows Yes / No. Live Camera does not — photoAtCatch is already true.
 */
export function shouldShowPhotoAtCatchPrompt(args: {
  busy: boolean;
  photoAtCatch: boolean | null;
  hasPhotoFile: boolean;
  importedPhotoPath?: string | null;
  mode: "create" | "edit";
}): boolean {
  return (
    !args.busy &&
    args.photoAtCatch === null &&
    Boolean(args.hasPhotoFile || (args.mode === "create" && args.importedPhotoPath))
  );
}

/**
 * iPhone can restore the last Log form from bfcache (cooler photo + Yes/No).
 * Remount only when there is no unsaved hold, so a saved catch does not come
 * back and an in-progress draft is left alone.
 */
export function shouldRemountLogFormAfterPageShow(args: {
  persisted: boolean;
  hasHeldPhoto: boolean;
}): boolean {
  return args.persisted && !args.hasHeldPhoto;
}
