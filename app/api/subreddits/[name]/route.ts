import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redditSubreddits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  await db.delete(redditSubreddits).where(eq(redditSubreddits.subredditName, name));
  return NextResponse.json({ ok: true });
}
