import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestedItems } from "@/lib/db/schema";
import { getAllEntities, upsertItems } from "@/lib/collectors/ingest";
import { collectHackerNews } from "@/lib/collectors/hackernews";
import { and, eq, max } from "drizzle-orm";

export async function POST() {
  const entities = await getAllEntities();
  let total = 0;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  for (const entity of entities) {
    try {
      const [row] = await db
        .select({
          lastIngest: max(ingestedItems.createdAt),
          lastPublished: max(ingestedItems.publishedAt),
        })
        .from(ingestedItems)
        .where(and(eq(ingestedItems.platform, "hackernews"), eq(ingestedItems.entityId, entity.id)));

      // Drizzle max() on timestamps returns string with Neon HTTP driver — wrap in new Date()
      const lastIngest = row?.lastIngest ? new Date(row.lastIngest) : null;
      const lastPublished = row?.lastPublished ? new Date(row.lastPublished) : null;

      const hasRecentNews = lastIngest && lastIngest > oneHourAgo;
      const sinceTs = lastPublished ? Math.floor(lastPublished.getTime() / 1000) : null;

      const items =
        hasRecentNews && sinceTs
          ? await collectHackerNews(entity, { since: sinceTs })
          : await collectHackerNews(entity, { limit: 5 });

      const inserted = await upsertItems(items);
      total += inserted;
    } catch (err) {
      console.error(`[HN:poll] entity ${entity.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, inserted: total });
}
