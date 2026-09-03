export const SETUP_KEY = "cast-log-setup-seen";
export const SETUP_EVENT = "cast-log-setup-change";
export const SETUP_OPEN_EVENT = "cast-log-open-setup";

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function setupStorageKey(anglerId?: string) {
  return anglerId ? `${SETUP_KEY}:${anglerId}` : SETUP_KEY;
}

export function setupSeen(anglerId?: string): boolean {
  if (!anglerId) return false;
  return store()?.getItem(setupStorageKey(anglerId)) === "1";
}

export function markSetupSeen(anglerId?: string) {
  if (!anglerId) return;
  store()?.setItem(setupStorageKey(anglerId), "1");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SETUP_EVENT));
  }
}

export function subscribeSetup(onChange: () => void) {
  window.addEventListener(SETUP_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SETUP_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function openSetup() {
  window.dispatchEvent(new Event(SETUP_OPEN_EVENT));
}

/** Hide until client has read localStorage; then show if unseen or Help forced it. */
export function shouldShowFirstRun(args: {
  ready: boolean;
  seen: boolean;
  forced: boolean;
  hasJournal?: boolean;
}): boolean {
  if (!args.ready) return false;
  if (args.forced) return true;
  if (args.hasJournal === false) return false;
  return !args.seen;
}
