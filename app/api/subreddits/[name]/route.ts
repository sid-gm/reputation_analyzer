import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redditSubreddits } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");

  await db
    .delete(redditSubreddits)
    .where(
      companyId
        ? and(eq(redditSubreddits.subredditName, name), eq(redditSubreddits.companyId, companyId))
        : eq(redditSubreddits.subredditName, name)
    );

  return NextResponse.json({ ok: true });
}
