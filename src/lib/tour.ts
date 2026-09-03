export const TOUR_KEY = "cast-log-tour-seen";
export const TOUR_EVENT = "cast-log-tour-change";
export const TOUR_OPEN_EVENT = "cast-log-open-tour";
export const AUTH_CHANGE_EVENT = "cast-log-auth-change";

/** Old photo-import prompt. Must not count as completing this walkthrough. */
export const LEGACY_SETUP_KEY = "cast-log-setup-seen";

export type TourScreen = {
  id: string;
  title: string;
  body: string;
};

/** Short first-sign-in walkthrough — one idea per screen, not a manual. */
export const TOUR_SCREENS: TourScreen[] = [
  {
    id: "log",
    title: "Log a catch",
    body: "After sign-in, allow location if you want a live photo to drop the pin. Then tap Log, take or pick a photo, and save. One photo is one trip.",
  },
  {
    id: "calendar",
    title: "Calendar Log",
    body: "Your trips live here. Switch Calendar, List, or Grid. Tap a day for the map, notes, and photos.",
  },
  {
    id: "plan",
    title: "Plan a day",
    body: "Pick a day. We suggest spots that match tides and weather from your log.",
  },
  {
    id: "more",
    title: "Old photos and friends",
    body: "Backfill adds past catches from photos you already have. To share a spot, link a friend under More, then tap Share on that catch. Linking shares nothing until you do.",
  },
];

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function tourStorageKey(anglerId?: string) {
  return anglerId ? `${TOUR_KEY}:${anglerId}` : TOUR_KEY;
}

export function tourSeen(anglerId?: string): boolean {
  if (!anglerId) return false;
  return store()?.getItem(tourStorageKey(anglerId)) === "1";
}

export function markTourSeen(anglerId?: string) {
  if (!anglerId) return;
  store()?.setItem(tourStorageKey(anglerId), "1");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TOUR_EVENT));
  }
}

export function subscribeTour(onChange: () => void) {
  window.addEventListener(TOUR_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(TOUR_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function openTour() {
  window.dispatchEvent(new Event(TOUR_OPEN_EVENT));
}

export function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

/**
 * Auto-show once per signed-in account after client + /api/me are ready.
 * Help can force it open even after skip. The old photo-setup key is ignored.
 */
export function shouldShowTour(args: {
  ready: boolean;
  seen: boolean;
  forced: boolean;
  signedIn?: boolean;
}): boolean {
  if (!args.ready) return false;
  if (args.forced) return true;
  if (args.signedIn !== true) return false;
  return !args.seen;
}
