import {
  DEFAULT_HABITAT,
  HABITAT_LABELS,
  isHabitat,
  isSaltwaterHabitat,
  saltwaterHintFromLocation,
  SPECIES_CATALOG,
  type Habitat,
} from "../habitat";
import {
  habitatForSuggestion,
  matchSaltwaterCatalogSpecies,
  normalizeSpeciesList,
  restrictSuggestionToSaltwater,
} from "../species";
import type { SpeciesSuggestion } from "../types";
import type { VisionContext } from "./demo";

type OpenAIResponse = {
  choices?: { message?: { content?: string } }[];
};

export function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function catalogBlock(habitat?: Habitat | null): string {
  const rows = isSaltwaterHabitat(habitat)
    ? SPECIES_CATALOG.filter((s) => s.habitat === habitat)
    : SPECIES_CATALOG.filter((s) => s.habitat !== "freshwater");
  return rows.map((s) => `- ${s.name} (${HABITAT_LABELS[s.habitat]})`).join("\n");
}

function regionHint(context?: VisionContext): string {
  const bits: string[] = [];
  if (context?.habitat && isSaltwaterHabitat(context.habitat)) {
    bits.push(`Angler selected water: ${context.habitat}. Prefer species from that saltwater list.`);
  }
  const fromLoc = saltwaterHintFromLocation(
    context?.latitude,
    context?.longitude,
    context?.placeName,
  );
  if (fromLoc) {
    bits.push(
      `Location suggests ${fromLoc} (US/Gulf/Atlantic heuristics). If the fish is ambiguous, prefer common US and Gulf names from that saltwater list.`,
    );
  }
  if (context?.placeName) bits.push(`Place name: ${context.placeName}.`);
  if (context?.latitude != null && context?.longitude != null) {
    bits.push(`Coordinates: ${context.latitude.toFixed(3)}, ${context.longitude.toFixed(3)}.`);
  }
  return bits.join(" ");
}

function saltwaterHint(context?: VisionContext): Habitat | null {
  if (context?.habitat && isSaltwaterHabitat(context.habitat)) return context.habitat;
  return saltwaterHintFromLocation(context?.latitude, context?.longitude, context?.placeName);
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
  const hinted = saltwaterHint(context);

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
          content: `You identify saltwater fish in angler photos for a US saltwater logbook (Gulf, Atlantic, inshore and offshore).
Return JSON only:
{"species":"common name","confidence":0-1,"speciesList":["common name"],"habitat":"saltwater-inshore"|"saltwater-offshore","alternatives":[{"species":"","confidence":0-1}]}

Rules:
- Use the common name a US/Gulf angler would write in a log (Redfish not Red drum, Speckled Trout not Cynoscion nebulosus, Mahi-mahi not Dolphin).
- ONLY use names from this saltwater catalog when they fit:
${catalogBlock(hinted)}
- Never return freshwater names: no Largemouth Bass, Smallmouth Bass, Rainbow Trout, Brown Trout, Bluegill, crappie, catfish, walleye, or other inland fish.
- If more than one saltwater species is visible, put every identifiable catalog species in speciesList (most confident first). species is the top name. Do not invent fish that are not in the photo.
- If the fish is freshwater, not in this catalog, or not clearly visible, species is "Unknown", speciesList is [], and confidence is below 0.4.
- Never invent a species you cannot see. If two catalog species look alike, pick the more common one for the hinted region and lower confidence.
- Habitat: saltwater inshore (bays, flats, surf) vs saltwater offshore (blue water, pelagics, reef). Never freshwater.
- Confidence: 0.85+ only when markings are clear; 0.5–0.7 if likely; below 0.5 if guessing.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `What saltwater fish species are in this photo? List every catalog species you can see. ${regionHint(context)} If it is not a catalog saltwater fish or you are unsure, return Unknown with low confidence.`,
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

  const mapped = matchSaltwaterCatalogSpecies(parsed.species) ?? "";
  const speciesList = normalizeSpeciesList(
    mapped,
    (parsed.speciesList ?? []).map((s) => matchSaltwaterCatalogSpecies(s) ?? "").filter(Boolean),
  );
  const habitatGuess =
    (parsed.habitat && isHabitat(parsed.habitat) && isSaltwaterHabitat(parsed.habitat)
      ? parsed.habitat
      : null) ??
    (mapped ? habitatForSuggestion(mapped, hinted) : hinted ?? DEFAULT_HABITAT);

  const alternatives = (parsed.alternatives ?? [])
    .map((a) => ({
      species: matchSaltwaterCatalogSpecies(a.species) ?? "",
      confidence: clamp01(a.confidence),
    }))
    .filter((a) => a.species && !speciesList.some((s) => s.toLowerCase() === a.species.toLowerCase()))
    .slice(0, 3);

  return restrictSuggestionToSaltwater({
    species: mapped || "Unknown",
    confidence: clamp01(parsed.confidence ?? 0.4),
    speciesList,
    habitat: habitatGuess,
    alternatives,
    source: "openai",
    note: "Vision assist — confirm or edit the species. This is not a guarantee.",
  });
}

export async function detectFishWithOpenAI(
  image: Buffer,
  mimeType: string,
): Promise<{ isFish: boolean; confidence: number; note: string; source: "openai" }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o";
  const dataUrl = `data:${mimeType};base64,${image.toString("base64")}`;

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
          content:
            'You decide whether an angler photo contains a real fish (in hand, on a boat, on ice, or clearly in the frame). Return JSON {"isFish":boolean,"confidence":0-1}. Drawings, empty landscapes, people-only selfies, and food menus are isFish false. A cooked fish plate can be true if a fish is visible.',
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Is there a fish in this photo?" },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI vision error ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let parsed: { isFish?: boolean; confidence?: number } = {};
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as typeof parsed;
  } catch {
    parsed = {};
  }
  const isFish = Boolean(parsed.isFish);
  return {
    isFish,
    confidence: clamp01(parsed.confidence ?? (isFish ? 0.6 : 0.5)),
    source: "openai",
    note: isFish
      ? "Looks like a fish — confirm before it goes in the log."
      : "Does not look like a fish catch photo.",
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
