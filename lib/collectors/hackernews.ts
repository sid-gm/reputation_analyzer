import type { NewIngestedItem, TrackedEntity } from "@/lib/db/schema";

interface HNHit {
  objectID: string;
  title?: string;
  story_text?: string;
  comment_text?: string;
  url?: string;
  author: string;
  created_at: string;
  _tags: string[];
  [key: string]: unknown;
}

export async function collectHackerNews(
  entity: TrackedEntity,
  opts?: { limit?: number; since?: number }
): Promise<NewIngestedItem[]> {
  const limit = opts?.limit ?? 20;
  const query = encodeURIComponent(entity.queryString);
  let url = `https://hn.algolia.com/api/v1/search_by_date?query=${query}&hitsPerPage=${limit}&tags=(story,comment)`;
  if (opts?.since) url += `&numericFilters=created_at_i%3E${opts.since}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HN API error: ${res.status}`);

  const data = (await res.json()) as { hits: HNHit[] };

  return data.hits.map((hit) => ({
    entityId: entity.id,
    platform: "hackernews" as const,
    externalId: hit.objectID,
    url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
    title: hit.title ?? null,
    body: hit.comment_text ?? hit.story_text ?? null,
    author: hit.author,
    publishedAt: new Date(hit.created_at),
    rawJson: hit,
  }));
}
