export const HELP_OPEN_EVENT = "cast-log-open-help";
export const HELP_TIP_EVENT = "cast-log-help-tip-change";
export const HELP_TIP_KEY = "cast-log-help-tip-seen";

export type HelpSection = {
  title: string;
  steps: string[];
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Log a catch",
    steps: [
      "Tap Log, then take or pick one photo.",
      "After sign-in, tap Allow location. On Log, Turn location on asks this phone — Camera waits until it answers. Camera-roll still asks Yes or No.",
      "Pick a saltwater species now, or save and add it later. Tap a chip or type a name.",
      "Drop the pin on the water you fished.",
      "Name the area if you want — leave it blank if the map already named it.",
      "Save. One photo is one trip at one pin.",
    ],
  },
  {
    title: "Location / map pin won’t drop",
    steps: [
      "On iPhone: Settings → Privacy & Security → Location Services → On.",
      "Scroll to Safari Websites → Ask or While Using — not Never.",
      "Avoid Private browsing. Then open Log and tap Turn location on again.",
      "Safari → Location Ask/Allow alone is not enough — Location Services must list Safari Websites.",
    ],
  },
  {
    title: "Log bait",
    steps: [
      "Tap Log bait and pin the hole.",
      "Tag shrimp, mullet, crabs, or whatever you threw.",
      "Save so Plan can match similar tides later.",
    ],
  },
  {
    title: "Plan a day",
    steps: [
      "Pick a day on the calendar.",
      "We suggest spots that match tides and weather from your log.",
      "Tap a match to open that trip’s photo and map. Show spot on map for the hole.",
      "Add a note for that day — it stays on Calendar Log too.",
    ],
  },
  {
    title: "Calendar Log",
    steps: [
      "Tap a day to open that date’s map, notes, and trips.",
      "Open a day and use Select spots to share for several pins at once. Off until you choose.",
      "Same date across years stays grouped so you can compare.",
    ],
  },
  {
    title: "Your journal",
    steps: [
      "Sign in or create an account with email and a password to open your journal.",
      "After you sign in, tap Allow location so this phone can pin a live photo. Skip and Log still has Turn location on.",
      "After you sign in, Home shows Log out. The next person sees sign-in, not your trips.",
    ],
  },
  {
    title: "Share with a friend",
    steps: [
      "On Home, open More, then Linked friends. Enter their invite code and tap Link, or copy yours.",
      "Linking shares nothing. Never public. They see a spot only after you tap Share or Select spots to share.",
      "Open a catch photo and tap Share next to Edit. It becomes Shared — that spot is what they can see.",
      "On Calendar Log, open a day and use Select spots to share for several pins at once.",
      "On Calendar Log, your friend checks Include shared from linked friends to see your shared spots.",
    ],
  },
  {
    title: "Spots",
    steps: [
      "Switch Catch or Bait at the top.",
      "Rows show a small thumb when you have a photo.",
      "Tap a row or pin — details open just under the map.",
    ],
  },
  {
    title: "Backfill",
    steps: [
      "Add one past catch, or tap Find fish photos and pick a batch.",
      "Pick a saltwater species, or save and add it later. No camera on Backfill.",
      "We keep every photo you pick. Photos you choose are not marked unlikely. A folder scan still ranks likely first.",
      "Confirm, pin the water, and save. Help → How this works replays the short tour.",
    ],
  },
  {
    title: "Swipe between tabs",
    steps: [
      "Drag the page sideways — it follows your finger.",
      "Let go to settle on the next or previous tab.",
      "Maps and lists still scroll; swipe on the page, not the map.",
    ],
  },
];

export function openHelpGuide() {
  window.dispatchEvent(new Event(HELP_OPEN_EVENT));
}

export function helpTipSeen(): boolean {
  return localStorage.getItem(HELP_TIP_KEY) === "1";
}

export function markHelpTipSeen() {
  localStorage.setItem(HELP_TIP_KEY, "1");
  window.dispatchEvent(new Event(HELP_TIP_EVENT));
}

export function subscribeHelpTip(onChange: () => void) {
  window.addEventListener(HELP_TIP_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(HELP_TIP_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
