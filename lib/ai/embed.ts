import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

const MAX_CHARS = 24_000;

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text.slice(0, MAX_CHARS),
  });
  return embedding;
}
