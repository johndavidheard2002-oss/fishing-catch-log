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
