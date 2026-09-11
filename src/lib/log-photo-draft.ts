/**
 * Live Log photo draft: IndexedDB hold is only for an unsaved pick in this
 * tab session (or a refresh of that pick). A hold left after a successful
 * save — including pre-#85 leftover cooler photos — must never come back.
 */

export const LOG_PHOTO_DRAFT_SESSION_KEY = "tide-mark-log-photo-draft";
export const LOG_PHOTO_HOLD_MIGRATION_KEY = "tide-mark-log-hold-cleared-v2";

function readStore(name: "localStorage" | "sessionStorage"): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window[name];
  } catch {
    return null;
  }
}

export function isLogPhotoSessionDraft(storage?: Storage | null): boolean {
  const store = storage === undefined ? readStore("sessionStorage") : storage;
  return store?.getItem(LOG_PHOTO_DRAFT_SESSION_KEY) === "1";
}

export function markLogPhotoSessionDraft(storage?: Storage | null): void {
  const store = storage === undefined ? readStore("sessionStorage") : storage;
  store?.setItem(LOG_PHOTO_DRAFT_SESSION_KEY, "1");
}

export function clearLogPhotoSessionDraft(storage?: Storage | null): void {
  const store = storage === undefined ? readStore("sessionStorage") : storage;
  store?.removeItem(LOG_PHOTO_DRAFT_SESSION_KEY);
}

export function shouldRunStaleHoldMigration(storage?: Storage | null): boolean {
  const store = storage === undefined ? readStore("localStorage") : storage;
  return store?.getItem(LOG_PHOTO_HOLD_MIGRATION_KEY) !== "1";
}

export function markStaleHoldMigrationDone(storage?: Storage | null): void {
  const store = storage === undefined ? readStore("localStorage") : storage;
  store?.setItem(LOG_PHOTO_HOLD_MIGRATION_KEY, "1");
}

/** Drop leftover holds from a prior save when this Log visit is not a mid-draft. */
export function shouldClearStaleHeldLogPhoto(args: { hasSessionDraft: boolean }): boolean {
  return !args.hasSessionDraft;
}

export function shouldRestoreHeldLogPhoto(args: {
  mode: "create" | "edit";
  pastMode: boolean;
  hasInitial: boolean;
  importedPhotoPath: string | null | undefined;
  hasPhotoFile: boolean;
  hasSessionDraft: boolean;
}): boolean {
  return (
    args.mode === "create" &&
    !args.pastMode &&
    !args.hasInitial &&
    !args.importedPhotoPath &&
    !args.hasPhotoFile &&
    args.hasSessionDraft
  );
}

/** Apply a held-photo restore only if nothing newer was chosen while it loaded. */
export function shouldApplyHeldLogPhoto(args: {
  cancelled: boolean;
  hasBlob: boolean;
  restoreGeneration: number;
  chosenGeneration: number;
  hasSessionDraft: boolean;
}): boolean {
  return (
    !args.cancelled &&
    args.hasBlob &&
    args.hasSessionDraft &&
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
 * iPhone bfcache can restore the last Log form (cooler photo + Yes/No).
 * Remount unless this tab still has an unsaved mid-draft.
 */
export function shouldRemountLogFormAfterPageShow(args: {
  persisted: boolean;
  hasSessionDraft: boolean;
}): boolean {
  return args.persisted && !args.hasSessionDraft;
}
