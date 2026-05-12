import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestedItems, trackedEntities } from "@/lib/db/schema";
import { desc, eq, and, SQL } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const entityId = searchParams.get("entityId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const conditions: SQL[] = [];
  if (platform) conditions.push(eq(ingestedItems.platform, platform as never));
  if (entityId) conditions.push(eq(ingestedItems.entityId, entityId));

  const items = await db
    .select({
      id: ingestedItems.id,
      entityId: ingestedItems.entityId,
      entityLabel: trackedEntities.label,
      platform: ingestedItems.platform,
      externalId: ingestedItems.externalId,
      url: ingestedItems.url,
      title: ingestedItems.title,
      body: ingestedItems.body,
      author: ingestedItems.author,
      publishedAt: ingestedItems.publishedAt,
      createdAt: ingestedItems.createdAt,
    })
    .from(ingestedItems)
    .leftJoin(trackedEntities, eq(ingestedItems.entityId, trackedEntities.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ingestedItems.publishedAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(items);
}
