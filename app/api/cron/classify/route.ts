import { NextResponse } from "next/server";
import { and, count, eq, gt, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { clusters, clusterItems, ingestedItems, trackedEntities } from "@/lib/db/schema";
import { verifyCronSecret } from "@/lib/cron-auth";
import { classifyCluster, classifyItemSignals } from "@/lib/ai/classify";

const BATCH_SIZE = 15;

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Classify: unclassified clusters with ≥2 items, OR narrative clusters with new items since last classification
  const toClassify = await db
    .select({
      id: clusters.id,
      entityId: clusters.entityId,
      label: clusters.label,
      itemCount: clusters.itemCount,
      firstSeenAt: clusters.firstSeenAt,
      lastSeenAt: clusters.lastSeenAt,
      classifiedAt: clusters.classifiedAt,
      classification: clusters.classification,
    })
    .from(clusters)
    .where(
      and(
        isNull(clusters.archivedAt),
        gte(clusters.itemCount, 2),
        // unclassified, or narrative that got new items since last classified
        and(
          isNull(clusters.analystClassification) // don't re-run if analyst already overrode
        )
      )
    )
    .limit(BATCH_SIZE);

  let classified = 0;
  let signalsTagged = 0;

  for (const cluster of toClassify) {
    // Skip if already classified and no new items since classifiedAt
    if (
      cluster.classification !== "unclassified" &&
      cluster.classifiedAt &&
      cluster.lastSeenAt <= cluster.classifiedAt
    ) {
      continue;
    }

    try {
      // Fetch entity label
      const [entity] = cluster.entityId
        ? await db
            .select({ label: trackedEntities.label })
            .from(trackedEntities)
            .where(eq(trackedEntities.id, cluster.entityId))
        : [{ label: "Unknown" }];

      // Fetch top 5 item titles
      const items = await db
        .select({
          title: ingestedItems.title,
          body: ingestedItems.body,
          platform: ingestedItems.platform,
        })
        .from(clusterItems)
        .innerJoin(ingestedItems, eq(clusterItems.itemId, ingestedItems.id))
        .where(eq(clusterItems.clusterId, cluster.id))
        .limit(5);

      const platforms = [...new Set(items.map((i) => i.platform))];
      const titles = items.map((i) => i.title ?? i.body?.slice(0, 120) ?? "").filter(Boolean);
      if (titles.length === 0) continue;

      const ageInDays =
        (now.getTime() - new Date(cluster.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24);

      // Compute momentum: items added in last 48h / 2
      const [recentCount] = await db
        .select({ cnt: count(clusterItems.itemId) })
        .from(clusterItems)
        .where(
          and(eq(clusterItems.clusterId, cluster.id), gt(clusterItems.addedAt, twoDaysAgo))
        );
      const momentum = (recentCount?.cnt ?? 0) / 2;

      // Call AI classification
      const result = await classifyCluster({
        entityLabel: entity?.label ?? "Unknown",
        clusterLabel: cluster.label,
        itemTitles: titles,
        itemCount: cluster.itemCount,
        ageInDays,
        platformCount: platforms.length,
      });

      // Write classification back to cluster
      await db
        .update(clusters)
        .set({
          classification: result.classification,
          narrativeStage: result.narrativeStage ?? undefined,
          narrativeSummary: result.narrativeSummary,
          classificationConfidence: result.confidence,
          momentum,
          classifiedAt: now,
        })
        .where(eq(clusters.id, cluster.id));

      classified++;

      // If narrative, classify items that haven't been tagged yet
      if (result.classification === "narrative" && result.narrativeSummary) {
        const untaggedItems = await db
          .select({
            itemId: clusterItems.itemId,
            title: ingestedItems.title,
            body: ingestedItems.body,
            platform: ingestedItems.platform,
          })
          .from(clusterItems)
          .innerJoin(ingestedItems, eq(clusterItems.itemId, ingestedItems.id))
          .where(
            and(
              eq(clusterItems.clusterId, cluster.id),
              eq(clusterItems.itemSignal, "unclassified"),
              isNull(clusterItems.analystSignal)
            )
          );

        if (untaggedItems.length > 0) {
          const signalResult = await classifyItemSignals({
            narrativeSummary: result.narrativeSummary,
            items: untaggedItems.map((i) => ({
              title: i.title,
              body: i.body,
              platform: i.platform,
            })),
          });

          for (const classified of signalResult.items) {
            const idx = classified.index - 1;
            if (idx < 0 || idx >= untaggedItems.length) continue;
            const item = untaggedItems[idx];
            await db
              .update(clusterItems)
              .set({ itemSignal: classified.signal, signalReason: classified.reason })
              .where(
                and(
                  eq(clusterItems.clusterId, cluster.id),
                  eq(clusterItems.itemId, item.itemId)
                )
              );
            signalsTagged++;
          }
        }
      }
    } catch (err) {
      console.error(`[cron/classify] cluster ${cluster.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, classified, signalsTagged });
}
