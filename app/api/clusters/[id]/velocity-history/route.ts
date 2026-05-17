import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clusterItems } from "@/lib/db/schema";
import { count, and, gte, eq, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const groupBy = sp.get("groupBy") === "day" ? "day" : "hour";

  let since: Date;
  let trunc: ReturnType<typeof sql>;
  let fmt: string;

  if (groupBy === "day") {
    const days = Math.min(Math.max(parseInt(sp.get("days") ?? "7", 10), 1), 90);
    since = new Date(Date.now() - days * 86400000);
    trunc = sql`DATE_TRUNC('day', ${clusterItems.addedAt})`;
    fmt = "YYYY-MM-DD";
  } else {
    const hours = Math.min(Math.max(parseInt(sp.get("hours") ?? "24", 10), 1), 168);
    since = new Date(Date.now() - hours * 3600000);
    trunc = sql`DATE_TRUNC('hour', ${clusterItems.addedAt})`;
    fmt = "YYYY-MM-DD HH24:00";
  }

  const rows = await db
    .select({
      bucket: sql<string>`TO_CHAR(${trunc}, ${fmt})`,
      count: count(),
    })
    .from(clusterItems)
    .where(and(eq(clusterItems.clusterId, id), gte(clusterItems.addedAt, since)))
    .groupBy(trunc)
    .orderBy(trunc);

  return NextResponse.json({ series: rows });
}
