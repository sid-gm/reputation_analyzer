import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clusters, clusterItems, ingestedItems } from "@/lib/db/schema";

function dedupeItems<T extends { url: string | null; title: string | null; similarity: number }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const key = item.url ?? item.title ?? "";
    if (!key) continue;
    const prev = seen.get(key);
    if (!prev || item.similarity > prev.similarity) seen.set(key, item);
  }
  return [...seen.values()];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db
    .select({
      clusterId: clusterItems.clusterId,
      itemId: ingestedItems.id,
      similarity: clusterItems.similarity,
      itemSignal: clusterItems.itemSignal,
      signalReason: clusterItems.signalReason,
      analystSignal: clusterItems.analystSignal,
      title: ingestedItems.title,
      body: ingestedItems.body,
      url: ingestedItems.url,
      platform: ingestedItems.platform,
      publishedAt: ingestedItems.publishedAt,
    })
    .from(clusterItems)
    .innerJoin(ingestedItems, eq(clusterItems.itemId, ingestedItems.id))
    .where(eq(clusterItems.clusterId, id))
    .orderBy(desc(clusterItems.similarity));

  const displayable = dedupeItems(rows.filter((i) => i.title || i.body || i.url));

  return NextResponse.json(displayable);
}
