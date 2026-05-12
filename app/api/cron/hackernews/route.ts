import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getAllEntities, upsertItems } from "@/lib/collectors/ingest";
import { collectHackerNews } from "@/lib/collectors/hackernews";

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const entities = await getAllEntities();
  let total = 0;

  for (const entity of entities) {
    try {
      const items = await collectHackerNews(entity);
      const inserted = await upsertItems(items);
      total += inserted;
    } catch (err) {
      console.error(`[HN] entity ${entity.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, inserted: total });
}
