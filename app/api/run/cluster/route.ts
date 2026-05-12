import { NextResponse } from "next/server";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { ingestedItems, clusters, clusterItems } from "@/lib/db/schema";

const SIMILARITY_THRESHOLD = 0.80;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function updateCentroid(centroid: number[], newVec: number[], n: number): number[] {
  return centroid.map((v, i) => (v * n + newVec[i]) / (n + 1));
}

export async function POST() {
  // No batch limit — process everything
  const unassigned = await db
    .select({
      id: ingestedItems.id,
      entityId: ingestedItems.entityId,
      publishedAt: ingestedItems.publishedAt,
      embedding: ingestedItems.embedding,
    })
    .from(ingestedItems)
    .leftJoin(clusterItems, eq(clusterItems.itemId, ingestedItems.id))
    .where(and(isNotNull(ingestedItems.embedding), isNull(clusterItems.itemId)));

  if (unassigned.length === 0) {
    return NextResponse.json({ ok: true, assigned: 0, created: 0 });
  }

  const byEntity = new Map<string, typeof unassigned>();
  for (const item of unassigned) {
    if (!item.entityId) continue;
    if (!byEntity.has(item.entityId)) byEntity.set(item.entityId, []);
    byEntity.get(item.entityId)!.push(item);
  }

  let assigned = 0;
  let created = 0;

  for (const [entityId, items] of byEntity) {
    const activeClusters = await db
      .select()
      .from(clusters)
      .where(and(eq(clusters.entityId, entityId), isNull(clusters.archivedAt)));

    for (const item of items) {
      const vec = item.embedding!;
      let bestClusterId: string | null = null;
      let bestSimilarity = 0;

      for (const cluster of activeClusters) {
        if (!cluster.centroidEmbedding) continue;
        const sim = cosineSimilarity(vec, cluster.centroidEmbedding);
        if (sim > bestSimilarity) {
          bestSimilarity = sim;
          if (sim >= SIMILARITY_THRESHOLD) bestClusterId = cluster.id;
        }
      }

      try {
        if (bestClusterId) {
          const cluster = activeClusters.find((c) => c.id === bestClusterId)!;
          const newCentroid = updateCentroid(cluster.centroidEmbedding!, vec, cluster.itemCount);
          const newCount = cluster.itemCount + 1;
          await db.update(clusters).set({ centroidEmbedding: newCentroid, itemCount: newCount, lastSeenAt: item.publishedAt ?? new Date() }).where(eq(clusters.id, bestClusterId));
          await db.insert(clusterItems).values({ clusterId: bestClusterId, itemId: item.id, similarity: bestSimilarity });
          cluster.centroidEmbedding = newCentroid;
          cluster.itemCount = newCount;
          assigned++;
        } else {
          const now = item.publishedAt ?? new Date();
          const [newCluster] = await db.insert(clusters).values({ entityId, centroidEmbedding: vec, itemCount: 1, firstSeenAt: now, lastSeenAt: now }).returning();
          await db.insert(clusterItems).values({ clusterId: newCluster.id, itemId: item.id, similarity: 1.0 });
          activeClusters.push(newCluster);
          created++;
        }
      } catch (err) {
        console.error(`[run/cluster] item ${item.id}:`, err);
      }
    }
  }

  console.log(`[run/cluster] assigned ${assigned}, created ${created}`);
  return NextResponse.json({ ok: true, assigned, created });
}
