import { NextResponse } from "next/server";
import { and, avg, count, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { clusters, clusterItems, ingestedItems } from "@/lib/db/schema";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId") ?? undefined;
  const sort = searchParams.get("sort") ?? "activity";
  const hideSingletons = searchParams.get("hideSingletons") === "true";

  const baseConditions = [isNull(clusters.archivedAt)];
  if (entityId) baseConditions.push(eq(clusters.entityId, entityId));
  if (hideSingletons) baseConditions.push(gte(clusters.itemCount, 2));

  const orderBy =
    sort === "size"    ? desc(clusters.itemCount) :
    sort === "created" ? desc(clusters.createdAt) :
                         desc(clusters.lastSeenAt);

  const allClusters = await db
    .select({
      id: clusters.id,
      entityId: clusters.entityId,
      label: clusters.label,
      itemCount: clusters.itemCount,
      firstSeenAt: clusters.firstSeenAt,
      lastSeenAt: clusters.lastSeenAt,
    })
    .from(clusters)
    .where(and(...baseConditions))
    .orderBy(orderBy);

  // Stats (no hideSingletons filter — always show total picture)
  const statsConditions = [isNull(clusters.archivedAt)];
  if (entityId) statsConditions.push(eq(clusters.entityId, entityId));

  const [clusterStats] = await db
    .select({ total: count(clusters.id), avgSize: avg(clusters.itemCount) })
    .from(clusters)
    .where(and(...statsConditions));

  const [itemStats] = await db
    .select({ totalItems: count(ingestedItems.id) })
    .from(ingestedItems);

  const [clusteredStats] = await db
    .select({ itemsClustered: count(clusterItems.itemId) })
    .from(clusterItems);

  // Fetch all items for visible clusters in one query, then group in memory
  const clusterIds = allClusters.map((c) => c.id);
  const allItems =
    clusterIds.length > 0
      ? await db
          .select({
            clusterId: clusterItems.clusterId,
            similarity: clusterItems.similarity,
            title: ingestedItems.title,
            body: ingestedItems.body,
            url: ingestedItems.url,
            platform: ingestedItems.platform,
            publishedAt: ingestedItems.publishedAt,
          })
          .from(clusterItems)
          .innerJoin(ingestedItems, eq(clusterItems.itemId, ingestedItems.id))
          .where(inArray(clusterItems.clusterId, clusterIds))
          .orderBy(desc(clusterItems.similarity))
      : [];

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

  const itemsByCluster = new Map<string, typeof allItems>();
  for (const item of allItems) {
    if (!itemsByCluster.has(item.clusterId)) itemsByCluster.set(item.clusterId, []);
    itemsByCluster.get(item.clusterId)!.push(item);
  }

  const result = allClusters.map((cluster) => {
    const items = itemsByCluster.get(cluster.id) ?? [];
    const platforms = [...new Set(items.map((i) => i.platform))];
    const displayable = dedupeItems(items.filter((i) => i.title || i.body || i.url));
    return { ...cluster, topItems: displayable.slice(0, 3), platforms };
  });

  try {
    return NextResponse.json({
      clusters: result,
      stats: {
        total: clusterStats?.total ?? 0,
        avgSize: parseFloat((clusterStats?.avgSize ?? "0").toString()).toFixed(1),
        itemsClustered: clusteredStats?.itemsClustered ?? 0,
        totalItems: itemStats?.totalItems ?? 0,
      },
    });
  } catch (err) {
    console.error("[GET /api/clusters]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
