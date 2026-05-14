import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db";
import { clusters, clusterItems, ingestedItems } from "@/lib/db/schema";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const now = new Date();

  // Narrative clusters that have new items since last classification
  const narratives = await db
    .select({
      id: clusters.id,
      label: clusters.label,
      narrativeSummary: clusters.narrativeSummary,
      classifiedAt: clusters.classifiedAt,
    })
    .from(clusters)
    .where(
      and(
        isNull(clusters.archivedAt),
        eq(clusters.classification, "narrative")
      )
    )
    .limit(20);

  let updated = 0;

  for (const cluster of narratives) {
    // Only refresh if there are items added after the last classification
    const hasNew = cluster.classifiedAt
      ? await db
          .select({ itemId: clusterItems.itemId })
          .from(clusterItems)
          .where(
            and(
              eq(clusterItems.clusterId, cluster.id),
              gt(clusterItems.addedAt, cluster.classifiedAt)
            )
          )
          .limit(1)
      : [{}]; // no classifiedAt means refresh anyway

    if (hasNew.length === 0) continue;

    try {
      const items = await db
        .select({ title: ingestedItems.title, body: ingestedItems.body })
        .from(clusterItems)
        .innerJoin(ingestedItems, eq(clusterItems.itemId, ingestedItems.id))
        .where(eq(clusterItems.clusterId, cluster.id))
        .limit(8);

      const titles = items.map((i) => i.title ?? i.body?.slice(0, 120) ?? "").filter(Boolean);
      if (titles.length === 0) continue;

      const prevSummary = cluster.narrativeSummary ?? "none";

      const { text } = await generateText({
        model: openai("gpt-4o-mini"),
        prompt: `Narrative topic: "${cluster.label ?? "Unnamed"}"
Previous summary: ${prevSummary}

Latest item titles:
${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Write an updated 1-2 sentence summary of what this narrative is about now, incorporating new developments. Be concise and factual.`,
        maxOutputTokens: 100,
      });

      const newSummary = text.trim();
      if (newSummary) {
        await db
          .update(clusters)
          .set({ narrativeSummary: newSummary, classifiedAt: now })
          .where(eq(clusters.id, cluster.id));
        updated++;
      }
    } catch (err) {
      console.error(`[summarize-narratives] cluster ${cluster.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, updated });
}
