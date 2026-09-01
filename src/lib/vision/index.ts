import type { SpeciesSuggestion } from "../types";
import { demoIdentifySpecies } from "./demo";
import { hasOpenAiKey, identifyWithOpenAI } from "./openai";

export async function identifySpecies(
  image: Buffer,
  mimeType: string,
): Promise<SpeciesSuggestion> {
  if (hasOpenAiKey()) {
    try {
      return await identifyWithOpenAI(image, mimeType);
    } catch {
      const fallback = demoIdentifySpecies(image);
      return {
        ...fallback,
        note: "Vision API failed — demo guess shown. Edit the species yourself.",
      };
    }
  }
  return demoIdentifySpecies(image);
}

export { hasOpenAiKey };
