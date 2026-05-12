import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const MAX_CHARS = 24_000;
const EMBED_CHUNK = 100; // OpenAI batch limit is 2048 inputs; 100 keeps total tokens safe

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text.slice(0, MAX_CHARS),
  });
  return embedding;
}

export async function embedAll(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_CHUNK) {
    const chunk = texts.slice(i, i + EMBED_CHUNK).map((t) => t.slice(0, MAX_CHARS));
    const { embeddings } = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: chunk,
    });
    results.push(...embeddings);
  }
  return results;
}
