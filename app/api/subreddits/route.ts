import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redditSubreddits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");

  const rows = await db
    .select()
    .from(redditSubreddits)
    .where(companyId ? eq(redditSubreddits.companyId, companyId) : undefined)
    .orderBy(redditSubreddits.createdAt);

  return NextResponse.json(rows);
}

const addSchema = z.object({
  subredditName: z.string().min(1).max(50).regex(/^[A-Za-z0-9_]+$/),
  companyId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subreddit name" }, { status: 400 });
  }

  const { subredditName, companyId } = parsed.data;

  try {
    const [row] = await db
      .insert(redditSubreddits)
      .values({ subredditName, companyId: companyId ?? null })
      .onConflictDoNothing()
      .returning();
    return NextResponse.json(row ?? { subredditName }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add subreddit" }, { status: 500 });
  }
}
