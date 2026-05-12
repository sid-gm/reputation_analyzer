import { db } from "@/lib/db";
import { ingestedItems, trackedEntities } from "@/lib/db/schema";
import type { NewIngestedItem } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function upsertItems(items: NewIngestedItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const result = await db
    .insert(ingestedItems)
    .values(items)
    .onConflictDoNothing({ target: [ingestedItems.platform, ingestedItems.externalId] })
    .returning({ id: ingestedItems.id });

  return result.length;
}

export async function getAllEntities() {
  return db.select().from(trackedEntities).orderBy(trackedEntities.createdAt);
}

export async function getEntitiesByType(type: "hackernews" | "reddit" | "twitter" | "google_alerts") {
  // All entities are polled for all platforms — filter by googleAlertsFeedUrl only for google_alerts
  if (type === "google_alerts") {
    return (await getAllEntities()).filter((e) => e.googleAlertsFeedUrl);
  }
  return getAllEntities();
}
