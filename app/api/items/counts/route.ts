import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestedItems, trackedEntities } from "@/lib/db/schema";
import { count, eq, inArray, and, SQL } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const companyId = searchParams.get("companyId");

  let entityIds: string[] | null = null;
  if (companyId) {
    const rows = await db
      .select({ id: trackedEntities.id })
      .from(trackedEntities)
      .where(eq(trackedEntities.companyId, companyId));
    entityIds = rows.map((e) => e.id);
  }

  const baseConditions: SQL[] = [];
  if (entityId) baseConditions.push(eq(ingestedItems.entityId, entityId));
  if (entityIds) {
    if (entityIds.length === 0) {
      return NextResponse.json({ all: 0 });
    }
    baseConditions.push(inArray(ingestedItems.entityId, entityIds));
  }

  const rows = await db
    .select({ platform: ingestedItems.platform, count: count() })
    .from(ingestedItems)
    .where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
    .groupBy(ingestedItems.platform);

  const result: Record<string, number> = { all: 0 };
  for (const row of rows) {
    result[row.platform] = row.count;
    result.all += row.count;
  }

  return NextResponse.json(result);
}
