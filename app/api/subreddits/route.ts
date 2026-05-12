import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redditSubreddits } from "@/lib/db/schema";
import { z } from "zod";

export async function GET() {
  const rows = await db
    .select()
    .from(redditSubreddits)
    .orderBy(redditSubreddits.createdAt);
  return NextResponse.json(rows);
}

const addSchema = z.object({
  subredditName: z.string().min(1).max(50).regex(/^[A-Za-z0-9_]+$/),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subreddit name" }, { status: 400 });
  }

  const { subredditName } = parsed.data;

  try {
    const [row] = await db
      .insert(redditSubreddits)
      .values({ subredditName })
      .onConflictDoNothing()
      .returning();
    return NextResponse.json(row ?? { subredditName }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add subreddit" }, { status: 500 });
  }
}
