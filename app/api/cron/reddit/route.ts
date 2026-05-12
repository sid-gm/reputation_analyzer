import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getAllEntities, getAllSubreddits, upsertItems } from "@/lib/collectors/ingest";
import { collectAllSubreddits, RedditClient } from "@/lib/collectors/reddit";

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const subreddits = await getAllSubreddits();
  if (subreddits.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: "No subreddits configured" });
  }

  const [entities, reddit] = await Promise.all([
    getAllEntities(),
    Promise.resolve(RedditClient.create()),
  ]);

  const items = await collectAllSubreddits(
    subreddits.map((s) => s.subredditName),
    entities,
    reddit
  );
  const inserted = await upsertItems(items);

  return NextResponse.json({ ok: true, inserted });
}
