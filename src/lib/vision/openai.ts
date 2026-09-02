import { habitatHintFromLocation, HABITAT_LABELS, isHabitat, SPECIES_CATALOG, type Habitat } from "../habitat";
import { habitatForSuggestion, normalizeSpeciesList, resolveSpeciesName } from "../species";
import type { SpeciesSuggestion } from "../types";
import type { VisionContext } from "./demo";

type OpenAIResponse = {
  choices?: { message?: { content?: string } }[];
};

export function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function catalogBlock(habitat?: Habitat | null): string {
  const rows = habitat
    ? SPECIES_CATALOG.filter((s) => s.habitat === habitat)
    : SPECIES_CATALOG;
  return rows.map((s) => `- ${s.name} (${HABITAT_LABELS[s.habitat]})`).join("\n");
}

function regionHint(context?: VisionContext): string {
  const bits: string[] = [];
  if (context?.habitat && isHabitat(context.habitat)) {
    bits.push(`Angler selected habitat: ${context.habitat}. Prefer species from that list.`);
  }
  const fromLoc = habitatHintFromLocation(
    context?.latitude,
    context?.longitude,
    context?.placeName,
  );
  if (fromLoc) {
    bits.push(
      `Location suggests ${fromLoc} (US/Gulf/Atlantic heuristics). If the fish is ambiguous, prefer common US and Gulf names from that habitat.`,
    );
  }
  if (context?.placeName) bits.push(`Place name: ${context.placeName}.`);
  if (context?.latitude != null && context?.longitude != null) {
    bits.push(`Coordinates: ${context.latitude.toFixed(3)}, ${context.longitude.toFixed(3)}.`);
  }
  return bits.join(" ");
}

export async function identifyWithOpenAI(
  image: Buffer,
  mimeType: string,
  context?: VisionContext,
): Promise<SpeciesSuggestion> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o";
  const dataUrl = `data:${mimeType};base64,${image.toString("base64")}`;
  const hinted =
    (context?.habitat && isHabitat(context.habitat) ? context.habitat : null) ??
    habitatHintFromLocation(context?.latitude, context?.longitude, context?.placeName);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You identify fish in angler photos for a US fishing journal (Gulf, Atlantic, inland lakes).
Return JSON only:
{"species":"common name","confidence":0-1,"speciesList":["common name"],"habitat":"freshwater"|"saltwater-inshore"|"saltwater-offshore","alternatives":[{"species":"","confidence":0-1}]}

Rules:
- Use the common name a US/Gulf angler would write in a log (Redfish not Red drum, Speckled Trout not Cynoscion nebulosus, Mahi-mahi not Dolphin).
- Prefer names from this catalog when they fit:
${catalogBlock(hinted)}
- If more than one fish species is visible, put every identifiable species in speciesList (most confident first). species is the top name. Do not invent fish that are not in the photo.
- If the fish is not clearly visible, species is "Unknown", speciesList is [], and confidence is below 0.4.
- Never invent a species you cannot see. If two species look alike, pick the more common one for the hinted region and lower confidence.
- Habitat: freshwater vs saltwater inshore (bays, flats, surf) vs saltwater offshore (blue water, pelagics, reef).
- Confidence: 0.85+ only when markings are clear; 0.5–0.7 if likely; below 0.5 if guessing.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `What fish species are in this photo? List every species you can see. ${regionHint(context)} If unsure, say so with low confidence and list alternatives.`,
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI vision error ${res.status}`);
  }

  const data = (await res.json()) as OpenAIResponse;
  const content = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: {
    species?: string;
    confidence?: number;
    habitat?: string;
    speciesList?: string[];
    alternatives?: { species: string; confidence: number }[];
  };
  try {
    parsed = JSON.parse(content) as typeof parsed;
  } catch {
    parsed = { species: "Unknown", confidence: 0.2, alternatives: [] };
  }

  const mapped = resolveSpeciesName(parsed.species, hinted);
  const speciesList = normalizeSpeciesList(
    mapped,
    (parsed.speciesList ?? []).map((s) => resolveSpeciesName(s, hinted)),
  );
  const habitatGuess =
    (parsed.habitat && isHabitat(parsed.habitat) ? parsed.habitat : null) ??
    habitatForSuggestion(mapped, hinted);

  const alternatives = (parsed.alternatives ?? [])
    .map((a) => ({
      species: resolveSpeciesName(a.species, hinted),
      confidence: clamp01(a.confidence),
    }))
    .filter((a) => a.species && !speciesList.some((s) => s.toLowerCase() === a.species.toLowerCase()))
    .slice(0, 3);

  return {
    species: mapped || "Unknown",
    confidence: clamp01(parsed.confidence ?? 0.4),
    speciesList,
    habitat: habitatGuess,
    alternatives,
    source: "openai",
    note: "Vision assist — confirm or edit the species. This is not a guarantee.",
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
