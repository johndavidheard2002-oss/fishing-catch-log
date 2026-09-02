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
      "Drop the pin on the water you fished.",
      "Name the area if you want — leave it blank if the map already named it.",
      "Save. One photo is one trip at one pin.",
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
      "Tap a suggested spot to see it on the map.",
    ],
  },
  {
    title: "Calendar Log",
    steps: [
      "Tap a day to open that date’s map, notes, and trips.",
      "Same date across years stays grouped so you can compare.",
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
      "Add a past catch from a photo you already have.",
      "Pin the water and save it like a live log.",
      "Help → Setup again walks through importing a batch onto dates.",
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
