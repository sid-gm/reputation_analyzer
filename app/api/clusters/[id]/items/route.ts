import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clusterItems, clusterMerges, ingestedItems } from "@/lib/db/schema";

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
      mergeId: clusterItems.mergeId,
      title: ingestedItems.title,
      body: ingestedItems.body,
      url: ingestedItems.url,
      platform: ingestedItems.platform,
      publishedAt: ingestedItems.publishedAt,
      ingestedAt: ingestedItems.createdAt,
    })
    .from(clusterItems)
    .innerJoin(ingestedItems, eq(clusterItems.itemId, ingestedItems.id))
    .where(eq(clusterItems.clusterId, id))
    .orderBy(desc(clusterItems.similarity));

  // Compute ingestion time range per mergeId before deduping
  const ingestedByMerge = new Map<string, { first: Date; last: Date }>();
  for (const row of rows) {
    if (!row.mergeId) continue;
    const d = row.ingestedAt;
    const existing = ingestedByMerge.get(row.mergeId);
    if (!existing) {
      ingestedByMerge.set(row.mergeId, { first: d, last: d });
    } else {
      if (d < existing.first) existing.first = d;
      if (d > existing.last) existing.last = d;
    }
  }

  const displayable = dedupeItems(
    rows.filter((i) => i.title || i.body || i.url).map(({ ingestedAt: _, ...rest }) => rest)
  );

  // Fetch merge records for this cluster (as surviving cluster)
  const mergeRows = await db
    .select()
    .from(clusterMerges)
    .where(eq(clusterMerges.survivingClusterId, id))
    .orderBy(clusterMerges.mergedAt);

  const merges: Record<string, {
    absorbedLabel: string | null;
    absorbedFirstSeenAt: string;
    absorbedLastSeenAt: string;
    absorbedItemCount: number;
    mergedAt: string;
    ingestedFirstAt: string;
    ingestedLastAt: string;
  }> = {};
  for (const m of mergeRows) {
    const ingestedRange = ingestedByMerge.get(m.id);
    merges[m.id] = {
      absorbedLabel: m.absorbedLabel,
      absorbedFirstSeenAt: m.absorbedFirstSeenAt.toISOString(),
      absorbedLastSeenAt: m.absorbedLastSeenAt.toISOString(),
      absorbedItemCount: m.absorbedItemCount,
      mergedAt: m.mergedAt.toISOString(),
      ingestedFirstAt: (ingestedRange?.first ?? m.mergedAt).toISOString(),
      ingestedLastAt: (ingestedRange?.last ?? m.mergedAt).toISOString(),
    };
  }

  return NextResponse.json({ items: displayable, merges });
}
