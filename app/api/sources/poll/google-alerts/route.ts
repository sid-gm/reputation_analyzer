import { NextResponse } from "next/server";
import { getAllEntities, upsertItems } from "@/lib/collectors/ingest";
import { collectGoogleAlerts } from "@/lib/collectors/google-alerts";

export async function POST() {
  const entities = (await getAllEntities()).filter((e) => e.googleAlertsFeedUrl);
  let total = 0;

  for (const entity of entities) {
    try {
      const items = await collectGoogleAlerts(entity);
      const inserted = await upsertItems(items);
      total += inserted;
    } catch (err) {
      console.error(`[GoogleAlerts:poll] entity ${entity.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, inserted: total });
}
