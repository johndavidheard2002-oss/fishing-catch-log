import type { SpeciesSuggestion } from "../types";
import { demoDetectFish, FISH_DETECT_MIN, type FishDetection } from "./detect";
import { demoIdentifySpecies, type VisionContext } from "./demo";
import { detectFishWithOpenAI, hasOpenAiKey, identifyWithOpenAI } from "./openai";

export async function identifySpecies(
  image: Buffer,
  mimeType: string,
  context?: VisionContext,
): Promise<SpeciesSuggestion> {
  if (hasOpenAiKey()) {
    try {
      return await identifyWithOpenAI(image, mimeType, context);
    } catch {
      const fallback = demoIdentifySpecies(image, context);
      return {
        ...fallback,
        note: "Vision API failed — demo guess shown. Edit the species yourself.",
      };
    }
  }
  return demoIdentifySpecies(image, context);
}

export async function detectFish(
  image: Buffer,
  mimeType: string,
  fileName = "",
): Promise<FishDetection> {
  if (hasOpenAiKey()) {
    try {
      return await detectFishWithOpenAI(image, mimeType);
    } catch {
      const fallback = demoDetectFish(image, fileName);
      return {
        ...fallback,
        note: "Vision API failed — demo detector used. Confirm before adding.",
      };
    }
  }
  return demoDetectFish(image, fileName);
}

export { hasOpenAiKey, FISH_DETECT_MIN };
export type { VisionContext, FishDetection };
