import Parser from "rss-parser";
import type { NewIngestedItem, TrackedEntity } from "@/lib/db/schema";

const parser = new Parser();

function stripHtml(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim() || null;
}

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
    title: stripHtml(item.title),
    body: item.contentSnippet ?? stripHtml(item.content),
    author: item.creator ?? null,
    publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    rawJson: item as Record<string, unknown>,
  }));
}
