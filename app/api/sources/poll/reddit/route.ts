import { NextResponse } from "next/server";
import { getAllEntities, getAllSubreddits, upsertItems } from "@/lib/collectors/ingest";
import { collectAllSubreddits, RedditClient } from "@/lib/collectors/reddit";

export async function POST() {
  const subreddits = await getAllSubreddits();
  if (subreddits.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
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
