import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getAllEntities, upsertItems } from "@/lib/collectors/ingest";
import { collectReddit } from "@/lib/collectors/reddit";

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const entities = await getAllEntities();
  let total = 0;

  for (const entity of entities) {
    try {
      const items = await collectReddit(entity);
      const inserted = await upsertItems(items);
      total += inserted;
    } catch (err) {
      console.error(`[Reddit] entity ${entity.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, inserted: total });
}
