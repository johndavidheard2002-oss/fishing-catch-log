export type FishDetection = {
  isFish: boolean;
  confidence: number;
  source: "openai" | "demo";
  note: string;
};

function hashBytes(bytes: Uint8Array): number {
  let h = 2166136261;
  const sample = bytes.length > 2048 ? bytes.subarray(0, 2048) : bytes;
  for (let i = 0; i < sample.length; i++) {
    h ^= sample[i];
    h = Math.imul(h, 16777619);
  }
  h ^= bytes.length;
  return h >>> 0;
}

const FISH_NAME =
  /\b(fish|catch|redfish|snapper|mahi|flounder|snook|speckled|tarpon|grouper|tuna|wahoo|drum|pompano|sheepshead|mackerel|cobia|permit|bonefish|striped|tripletail|ladyfish|whiting|bluefish|amberjack|sailfish|marlin|swordfish|triggerfish|barracuda)\b/i;
const DUCK_NAME =
  /\b(duck|pintail|pentel|wigeon|widgeon|teal|redhead|bufflehead|shoveler|shoveller|mallard|mottled|gadwall|canvasback|bluebill|scaup|wood.?duck|waterfowl)\b/i;
const NOT_FISH_NAME = /selfie|screenshot|screen.?shot|receipt|menu|invoice|\bmap\b/i;

/** Demo stand-in: filename hints plus a stable hash. Not a real detector. */
export function demoDetectFish(image: Uint8Array, fileName = ""): FishDetection {
  if (NOT_FISH_NAME.test(fileName)) {
    return {
      isFish: false,
      confidence: 0.82,
      source: "demo",
      note: "Demo detector: filename looks unlikely. Still in your batch to confirm.",
    };
  }
  if (FISH_NAME.test(fileName) || DUCK_NAME.test(fileName)) {
    return {
      isFish: true,
      confidence: 0.68,
      source: "demo",
      note: "Demo detector: filename looks like a catch photo. Confirm before adding.",
    };
  }
  const h = hashBytes(image);
  const isFish = h % 3 !== 0;
  return {
    isFish,
    confidence: isFish ? 0.46 : 0.62,
    source: "demo",
    note: isFish
      ? "Demo detector (no OpenAI key). Confirm this is actually a fish before adding."
      : "Demo detector marked this as unlikely. Still in your batch to confirm.",
  };
}

export const FISH_DETECT_MIN = 0.4;
