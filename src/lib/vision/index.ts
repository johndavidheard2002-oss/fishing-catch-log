import type { SpeciesSuggestion } from "../types";
import { demoIdentifySpecies, type VisionContext } from "./demo";
import { hasOpenAiKey, identifyWithOpenAI } from "./openai";

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

export { hasOpenAiKey };
export type { VisionContext };
