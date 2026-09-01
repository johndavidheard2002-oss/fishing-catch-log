import type { SpeciesSuggestion } from "../types";

type OpenAIResponse = {
  choices?: { message?: { content?: string } }[];
};

export function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function identifyWithOpenAI(
  image: Buffer,
  mimeType: string,
): Promise<SpeciesSuggestion> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini";
  const dataUrl = `data:${mimeType};base64,${image.toString("base64")}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You identify fish in angler photos. Return JSON: {\"species\":\"common name\",\"confidence\":0-1,\"alternatives\":[{\"species\":\"\",\"confidence\":0-1}]}. If it is not a fish, species is \"Unknown\" with low confidence. Prefer common names used by North American anglers. Never invent a catch you cannot see.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "What fish species is in this photo? If unsure, say so with low confidence.",
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
    alternatives?: { species: string; confidence: number }[];
  };
  try {
    parsed = JSON.parse(content) as typeof parsed;
  } catch {
    parsed = { species: "Unknown", confidence: 0.2, alternatives: [] };
  }

  return {
    species: parsed.species?.trim() || "Unknown",
    confidence: clamp01(parsed.confidence ?? 0.4),
    alternatives: (parsed.alternatives ?? []).slice(0, 3).map((a) => ({
      species: a.species,
      confidence: clamp01(a.confidence),
    })),
    source: "openai",
    note: "Vision assist — confirm or edit the species. This is not a guarantee.",
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
