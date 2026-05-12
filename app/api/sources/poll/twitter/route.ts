import { NextResponse } from "next/server";
import { getAllEntities, upsertItems } from "@/lib/collectors/ingest";
import { collectTwitter } from "@/lib/collectors/twitter";

export async function POST() {
  const entities = await getAllEntities();
  let total = 0;

  for (const entity of entities) {
    try {
      const items = await collectTwitter(entity);
      const inserted = await upsertItems(items);
      total += inserted;
    } catch (err) {
      console.error(`[Twitter:poll] entity ${entity.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, inserted: total });
}
