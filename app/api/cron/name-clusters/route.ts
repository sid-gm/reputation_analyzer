import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db";
import { clusters, clusterItems, ingestedItems } from "@/lib/db/schema";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const unnamed = await db
    .select()
    .from(clusters)
    .where(and(isNull(clusters.label), isNull(clusters.archivedAt), gte(clusters.itemCount, 2)))
    .limit(20);

  let named = 0;
  for (const cluster of unnamed) {
    try {
      const items = await db
        .select({ title: ingestedItems.title })
        .from(clusterItems)
        .innerJoin(ingestedItems, eq(clusterItems.itemId, ingestedItems.id))
        .where(eq(clusterItems.clusterId, cluster.id))
        .orderBy(desc(clusterItems.similarity))
        .limit(3);

      const titles = items.map((i) => i.title).filter(Boolean);
      if (titles.length === 0) continue;

      const { text } = await generateText({
        model: openai("gpt-4o-mini"),
        prompt: `These news headlines are all about the same topic. Respond with only a concise 3-6 word topic label, no punctuation:\n${titles.map((t) => `- ${t}`).join("\n")}`,
        maxOutputTokens: 20,
      });

      const label = text.trim();
      if (label) {
        await db.update(clusters).set({ label }).where(eq(clusters.id, cluster.id));
        named++;
      }
    } catch (err) {
      console.error(`[name-clusters] cluster ${cluster.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, named });
}
