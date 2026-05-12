import Parser from "rss-parser";
import type { NewIngestedItem, TrackedEntity } from "@/lib/db/schema";

const parser = new Parser();

export async function collectGoogleAlerts(
  entity: TrackedEntity
): Promise<NewIngestedItem[]> {
  if (!entity.googleAlertsFeedUrl) return [];

  const feed = await parser.parseURL(entity.googleAlertsFeedUrl);

  return (feed.items ?? []).map((item) => ({
    entityId: entity.id,
    platform: "google_alerts" as const,
    // Use the link as the external ID since Google Alerts items don't have stable IDs
    externalId: item.link ?? item.guid ?? null,
    url: item.link ?? null,
    title: item.title ?? null,
    body: item.contentSnippet ?? item.content ?? null,
    author: item.creator ?? null,
    publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    rawJson: item as Record<string, unknown>,
  }));
}
