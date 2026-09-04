export const PRIVACY_LINE = "Only shared with people you’ve linked.";

export const PRIVACY_DETAIL =
  "Never public. No feed, no discoverable profile, and no share-with-everyone. Linking a friend shares nothing until you select spots on Calendar Log. Unapproved people see nothing.";

export const AUTH_PRIVACY_LINE =
  "Your journal stays private. Linking a friend still shares nothing until you tap Share.";

export const PRIVACY_PATH = "/privacy";
export const PRIVACY_CONTACT_EMAIL = "johndavidheard2002@gmail.com";
export const PRIVACY_UPDATED = "September 4, 2026";

export type PrivacySection = {
  id: string;
  title: string;
  paragraphs: string[];
};

export const PRIVACY_INTRO =
  "Tide Mark is a private saltwater logbook. This page explains what we store, who can see it, where it is hosted, how the free month and yearly journal work, and how to ask us to delete it.";

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: "account",
    title: "Account email",
    paragraphs: [
      "You create a journal with your name, email address, and a password. Email is how you sign back in. We store the email on your angler record and keep the password as a one-way hash — we cannot read the password itself.",
      "We use the email only to run your account (sign-in, and to match a deletion request). Tide Mark does not sell email lists or send marketing mail.",
    ],
  },
  {
    id: "photos",
    title: "Catch photos",
    paragraphs: [
      "When you log a fish or backfill a past trip, you can attach a photo from the camera or your photo library. That picture is stored with the catch so you can see it later on Calendar Log, Plan, and Spots.",
      "Photos stay in your journal. A linked friend sees a photo only after you turn on Share for that trip or select those spots on Calendar Log. Nobody else can browse your pictures.",
    ],
  },
  {
    id: "location",
    title: "Location pins",
    paragraphs: [
      "Tide Mark can pin where you caught the fish on the map. A live Camera photo may use this phone’s location if you allowed it. A camera-roll photo may use a GPS stamp from the picture, and only after you say yes — or you drop the pin yourself.",
      "The pin (and any photo GPS we keep when it differs) is stored with that catch. Location is optional: skip Allow and the map stays empty until you tap a spot. Shared trips include the pin you chose; unshared days stay off a friend’s map.",
    ],
  },
  {
    id: "sharing",
    title: "Sharing with linked friends",
    paragraphs: [
      "Linking uses invite codes. Linking shares nothing. There is no public feed, no discoverable profile, and no share-with-everyone.",
      "A friend sees a catch, photo, or pin only after you tap Share on that trip or use Select spots to share on Calendar Log. You can unshare or unlink. Unapproved people see nothing.",
    ],
  },
  {
    id: "subscriptions",
    title: "Free month and yearly journal",
    paragraphs: [
      "New accounts get a free month of full Tide Mark access from the first time the trial starts (account creation, or the first successful sign-in that starts it). After that month, the journal is $39.99/year.",
      "If the free month ends without a paid year, Home stays open — account, subscribe, help, log out, and export. Other tabs lock. We do not delete your catches, photos, spots, or notes when the trial ends or the journal locks. App Store purchase will ship with the native build.",
    ],
  },
  {
    id: "hosting",
    title: "Hosting (Render and Turso)",
    paragraphs: [
      "The Tide Mark website and iOS WebView load from Render at fishing-catch-log-ivl7.onrender.com. Your journal rows (account, catches, pins, friend links, notes) live in a Turso / LibSQL database. Catch photos sit on a persistent disk on that same Render service.",
      "Weather, forecast, tides, and maps may be fetched from OpenWeather, Open-Meteo, NOAA CO-OPS, WorldTides, Esri, or OpenStreetMap when you log or plan — those services see the coordinates needed for that lookup, not your full history. An optional fish-photo helper may send a picture you already chose to OpenAI; species is still tagged by you.",
    ],
  },
  {
    id: "deletion",
    title: "How to request deletion",
    paragraphs: [
      "Email the Tide Mark operator from the same address you used to create the journal and ask us to delete your account. We will remove your angler record, catches, catch photos, bait spots, notes, and friend links from the hosted journal.",
      `Write to ${PRIVACY_CONTACT_EMAIL}. Say you want your Tide Mark journal deleted. We will confirm when it is gone. Signing out only ends this session — it does not erase the log.`,
    ],
  },
];
