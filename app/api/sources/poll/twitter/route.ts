import { NextResponse } from "next/server";
import { getAllEntities, upsertItems } from "@/lib/collectors/ingest";
import { collectTwitter } from "@/lib/collectors/twitter";

export async function POST() {
  const entities = await getAllEntities();
  let total = 0;
  const errors: { entityId: string; label: string; error: string }[] = [];

  for (const entity of entities) {
    try {
      const items = await collectTwitter(entity);
      const inserted = await upsertItems(items);
      total += inserted;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Twitter:poll] entity ${entity.id}:`, err);
      errors.push({ entityId: entity.id, label: entity.label, error: msg });
    }
  }

  return NextResponse.json({ ok: errors.length === 0, inserted: total, errors });
}
