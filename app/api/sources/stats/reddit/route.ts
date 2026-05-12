import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestedItems } from "@/lib/db/schema";
import { count, max, gte, eq, and } from "drizzle-orm";

export async function GET() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [todayRow] = await db
    .select({ count: count() })
    .from(ingestedItems)
    .where(and(eq(ingestedItems.platform, "reddit"), gte(ingestedItems.publishedAt, startOfToday)));

  const [sevenDaysRow] = await db
    .select({ count: count() })
    .from(ingestedItems)
    .where(and(eq(ingestedItems.platform, "reddit"), gte(ingestedItems.publishedAt, sevenDaysAgo)));

  const [lastPollRow] = await db
    .select({ lastPoll: max(ingestedItems.createdAt) })
    .from(ingestedItems)
    .where(eq(ingestedItems.platform, "reddit"));

  return NextResponse.json({
    today: todayRow?.count ?? 0,
    sevenDays: sevenDaysRow?.count ?? 0,
    lastPoll: lastPollRow?.lastPoll ?? null,
  });
}
