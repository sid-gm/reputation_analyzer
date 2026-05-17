import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clusterItems } from "@/lib/db/schema";
import { count, and, gte, eq, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const hours = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get("hours") ?? "24", 10), 1),
    168
  );

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const trunc = sql`DATE_TRUNC('hour', ${clusterItems.addedAt})`;

  const rows = await db
    .select({
      hour: sql<string>`TO_CHAR(${trunc}, 'YYYY-MM-DD HH24:00')`,
      count: count(),
    })
    .from(clusterItems)
    .where(and(eq(clusterItems.clusterId, id), gte(clusterItems.addedAt, since)))
    .groupBy(trunc)
    .orderBy(trunc);

  return NextResponse.json({ series: rows });
}
