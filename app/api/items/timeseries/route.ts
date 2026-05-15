import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestedItems } from "@/lib/db/schema";
import { count, and, gte, eq, sql } from "drizzle-orm";

const VALID_PLATFORMS = ["hackernews", "reddit", "twitter", "google_alerts", "manual"] as const;
type Platform = typeof VALID_PLATFORMS[number];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawPlatform = searchParams.get("platform");
  const platform: Platform | undefined = VALID_PLATFORMS.includes(rawPlatform as Platform)
    ? (rawPlatform as Platform)
    : undefined;
  const entityId = searchParams.get("entityId") ?? undefined;
  const groupBy = searchParams.get("groupBy") === "hour" ? "hour" : "day";
  const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "30", 10), 1), 90);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const fmt = groupBy === "hour" ? "YYYY-MM-DD HH24:MI" : "YYYY-MM-DD";
  const trunc = groupBy === "hour"
    ? sql`DATE_TRUNC('hour', ${ingestedItems.publishedAt})`
    : sql`DATE_TRUNC('day', ${ingestedItems.publishedAt})`;

  const conditions = [
    gte(ingestedItems.publishedAt, since),
    ...(platform ? [eq(ingestedItems.platform, platform)] : []),
    ...(entityId ? [eq(ingestedItems.entityId, entityId)] : []),
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
