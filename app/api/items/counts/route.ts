import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestedItems } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");

  const rows = await db
    .select({ platform: ingestedItems.platform, count: count() })
    .from(ingestedItems)
    .where(entityId ? eq(ingestedItems.entityId, entityId) : undefined)
    .groupBy(ingestedItems.platform);

  const result: Record<string, number> = { all: 0 };
  for (const row of rows) {
    result[row.platform] = row.count;
    result.all += row.count;
  }

  return NextResponse.json(result);
}
