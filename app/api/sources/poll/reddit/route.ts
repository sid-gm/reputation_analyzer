import { NextResponse } from "next/server";
import { getAllEntities, getAllSubreddits, upsertItems } from "@/lib/collectors/ingest";
import { collectSubreddit, RedditClient } from "@/lib/collectors/reddit";

export async function POST() {
  const subreddits = await getAllSubreddits();
  if (subreddits.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  const entities = await getAllEntities();
  const reddit = await RedditClient.create();
  let total = 0;

  for (const { subredditName } of subreddits) {
    try {
      const items = await collectSubreddit(subredditName, entities, reddit);
      const inserted = await upsertItems(items);
      total += inserted;
    } catch (err) {
      console.error(`[Reddit poll] r/${subredditName}:`, err);
    }
  }

  return NextResponse.json({ ok: true, inserted: total });
}
