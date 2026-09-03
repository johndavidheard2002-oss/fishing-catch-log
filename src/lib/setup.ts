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

export function setupSeen(): boolean {
  return store()?.getItem(SETUP_KEY) === "1";
}

export function markSetupSeen() {
  store()?.setItem(SETUP_KEY, "1");
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
}): boolean {
  if (!args.ready) return false;
  return args.forced || !args.seen;
}
