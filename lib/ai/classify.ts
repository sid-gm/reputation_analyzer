import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export type ClusterClassificationResult = {
  classification: "narrative" | "noise";
  narrativeSummary: string | null;
  confidence: number;
};

export type ItemSignalsResult = {
  items: Array<{
    index: number;
    signal: "signal" | "noise" | "watch";
    reason: string;
  }>;
};

export async function classifyCluster(opts: {
  entityLabel: string;
  clusterLabel: string | null;
  itemTitles: string[];
  itemCount: number;
  ageInDays: number;
  platformCount: number;
}): Promise<ClusterClassificationResult> {
  const { entityLabel, clusterLabel, itemTitles, itemCount, ageInDays, platformCount } = opts;
  const itemList = itemTitles.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `You are an analyst classifying content clusters for a reputation monitoring system. Respond ONLY with valid JSON.

Entity tracked: "${entityLabel}"
Cluster topic: "${clusterLabel ?? "Unnamed cluster"}"
Total items: ${itemCount} | Age: ${ageInDays.toFixed(1)} days | Sources: ${platformCount} platform(s)

Item titles (up to 5):
${itemList}

Classify this cluster:
- "narrative": a real developing story with coherent arc, multiple angles, building momentum
- "noise": keyword mentions without a story (press releases, job listings, generic name-drops, unrelated content)

Respond with JSON only, no markdown:
{"classification":"narrative"|"noise","narrativeSummary":"1-2 sentence summary if narrative, null if noise","confidence":0.0-1.0}`,
    maxOutputTokens: 200,
  });

  try {
    const raw = text.trim().replace(/^```json\s*/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(raw) as ClusterClassificationResult;
    return {
      classification: parsed.classification === "narrative" ? "narrative" : "noise",
      narrativeSummary: parsed.narrativeSummary ?? null,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
    };
  } catch {
    return { classification: "noise", narrativeSummary: null, confidence: 0.3 };
  }
}

export async function classifyItemSignals(opts: {
  narrativeSummary: string;
  items: Array<{ title: string | null; body: string | null; platform: string }>;
}): Promise<ItemSignalsResult> {
  const { narrativeSummary, items } = opts;
  const itemList = items
    .map(
      (item, i) =>
        `${i + 1}. [${item.platform}] ${item.title ?? item.body?.slice(0, 200) ?? "(no content)"}`
    )
    .join("\n");

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `Classify each item as signal, noise, or watch within this narrative. Respond ONLY with valid JSON.

Narrative: "${narrativeSummary}"

- "signal": adds new information, new facts or angles, original reporting
- "noise": repetitive, already covered, amplification without new info
- "watch": ambiguous, could become important, needs analyst attention

Items:
${itemList}

Respond with JSON only, no markdown:
{"items":[{"index":1,"signal":"signal"|"noise"|"watch","reason":"brief reason"},{"index":2,...},...]}`,
    maxOutputTokens: 500,
  });

  try {
    const raw = text.trim().replace(/^```json\s*/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(raw) as ItemSignalsResult;
    return { items: parsed.items ?? [] };
  } catch {
    return { items: [] };
  }
}
