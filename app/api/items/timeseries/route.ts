import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestedItems, trackedEntities } from "@/lib/db/schema";
import { count, and, gte, eq, sql, inArray } from "drizzle-orm";

const VALID_PLATFORMS = ["hackernews", "reddit", "twitter", "google_alerts", "manual"] as const;
type Platform = typeof VALID_PLATFORMS[number];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawPlatform = searchParams.get("platform");
  const platform: Platform | undefined = VALID_PLATFORMS.includes(rawPlatform as Platform)
    ? (rawPlatform as Platform)
    : undefined;
  const entityId = searchParams.get("entityId") ?? undefined;
  const companyId = searchParams.get("companyId") ?? undefined;
  const groupBy = searchParams.get("groupBy") === "hour" ? "hour" : "day";
  const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "30", 10), 1), 90);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let entityIds: string[] | null = null;
  if (companyId) {
    const rows = await db
      .select({ id: trackedEntities.id })
      .from(trackedEntities)
      .where(eq(trackedEntities.companyId, companyId));
    entityIds = rows.map((e) => e.id);
    if (entityIds.length === 0) {
      return NextResponse.json({ series: [] });
    }
  }

  const fmt = groupBy === "hour" ? "YYYY-MM-DD HH24:MI" : "YYYY-MM-DD";
  const trunc = groupBy === "hour"
    ? sql`DATE_TRUNC('hour', ${ingestedItems.publishedAt})`
    : sql`DATE_TRUNC('day', ${ingestedItems.publishedAt})`;

  const conditions = [
    gte(ingestedItems.publishedAt, since),
    ...(platform ? [eq(ingestedItems.platform, platform)] : []),
    ...(entityId ? [eq(ingestedItems.entityId, entityId)] : []),
    ...(entityIds ? [inArray(ingestedItems.entityId, entityIds)] : []),
  ];

  const rows = await db
    .select({
      date: sql<string>`TO_CHAR(${trunc}, ${fmt})`,
      count: count(),
    })
    .from(ingestedItems)
    .where(and(...conditions))
    .groupBy(trunc)
    .orderBy(trunc);

  return NextResponse.json({ series: rows });
}
