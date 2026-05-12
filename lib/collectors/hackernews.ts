import type { NewIngestedItem, TrackedEntity } from "@/lib/db/schema";

// queryString stores multi-platform syntax (booleans, from:handle, :alias) that Algolia rejects.
// Extract the first quoted term ("sam altman"), or strip operators and field tokens,
// falling back to entity.label if nothing clean remains.
function toHNQuery(entity: TrackedEntity): string {
  const qs = entity.queryString;
  const firstQuoted = qs.match(/"([^"]+)"/);
  if (firstQuoted) return firstQuoted[1];
  const cleaned = qs
    .split(/\s+/)
    .filter(
      (w) =>
        !/^\w+:/i.test(w) &&
        !/^:/i.test(w) &&
        !["or", "and", "not"].includes(w.toLowerCase())
    )
    .join(" ")
    .trim();
  return cleaned || entity.label;
}

interface HNHit {
  objectID: string;
  title?: string;
  story_text?: string;
  comment_text?: string;
  story_title?: string;
  story_id?: number;
  url?: string;
  author: string;
  created_at: string;
  _tags: string[];
  [key: string]: unknown;
}

async function fetchHits(url: string): Promise<HNHit[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HN API error: ${res.status}`);
  const data = (await res.json()) as { hits: HNHit[] };
  return data.hits;
}

export async function collectHackerNews(
  entity: TrackedEntity,
  opts?: { limit?: number; since?: number }
): Promise<NewIngestedItem[]> {
  const limit = opts?.limit ?? 20;
  const query = encodeURIComponent(toHNQuery(entity));
  const sinceParam = opts?.since ? `&numericFilters=created_at_i%3E${opts.since}` : "";

  const storyUrl = `https://hn.algolia.com/api/v1/search_by_date?query=${query}&hitsPerPage=${limit}&tags=story${sinceParam}`;
  const commentUrl = `https://hn.algolia.com/api/v1/search_by_date?query=${query}&hitsPerPage=${limit}&tags=comment${sinceParam}`;

  const [stories, comments] = await Promise.all([
    fetchHits(storyUrl),
    fetchHits(commentUrl),
  ]);

  const storyItems: NewIngestedItem[] = stories.map((hit) => ({
    entityId: entity.id,
    platform: "hackernews" as const,
    externalId: hit.objectID,
    url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
    title: hit.title ?? null,
    body: hit.story_text ?? null,
    author: hit.author,
    publishedAt: new Date(hit.created_at),
    subtype: "story",
    rawJson: hit,
  }));

  const commentItems: NewIngestedItem[] = comments.map((hit) => ({
    entityId: entity.id,
    platform: "hackernews" as const,
    externalId: hit.objectID,
    url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    title: hit.story_title ?? null,
    body: hit.comment_text ?? null,
    author: hit.author,
    publishedAt: new Date(hit.created_at),
    subtype: "comment",
    rawJson: hit,
  }));

  return [...storyItems, ...commentItems];
}
