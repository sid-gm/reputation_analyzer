import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getAllEntities, upsertItems } from "@/lib/collectors/ingest";
import { collectGoogleAlerts } from "@/lib/collectors/google-alerts";

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const entities = (await getAllEntities()).filter((e) => e.googleAlertsFeedUrl);
  let total = 0;

  for (const entity of entities) {
    try {
      const items = await collectGoogleAlerts(entity);
      const inserted = await upsertItems(items);
      total += inserted;
    } catch (err) {
      console.error(`[GoogleAlerts] entity ${entity.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, inserted: total });
}
