import type { NewIngestedItem, TrackedEntity } from "@/lib/db/schema";
import type { RedditPost } from "./reddit-client";
import { RedditClient } from "./reddit-client";

export { RedditClient };

function matchPosts(
  posts: RedditPost[],
  entities: TrackedEntity[]
): NewIngestedItem[] {
  const items: NewIngestedItem[] = [];
  const seen = new Set<string>();

  for (const post of posts) {
    const titleLower = post.title.toLowerCase();
    const bodyLower = (post.text || "").toLowerCase();

    const matchingEntity = entities.find((entity) => {
      const kw = entity.label.toLowerCase();
      return titleLower.includes(kw) || bodyLower.includes(kw);
    });

    if (matchingEntity && !seen.has(post.post_id)) {
      seen.add(post.post_id);
      items.push({
        entityId: matchingEntity.id,
        platform: "reddit" as const,
        externalId: post.post_id,
        url: post.permalink,
        title: post.title,
        body: post.text || null,
        author: post.author,
        publishedAt: new Date(post.created_utc_iso),
        subtype: post.subreddit,
        rawJson: post,
      });
    }
  }

  return items;
}

export async function collectAllSubreddits(
  subredditNames: string[],
  entities: TrackedEntity[],
  reddit: RedditClient
): Promise<NewIngestedItem[]> {
  if (subredditNames.length === 0) return [];
  const posts = await reddit
    .getBatchNewPosts({ subreddits: subredditNames, limit: 100 })
    .all();
  return matchPosts(posts, entities);
}

// Single-subreddit variant kept for compatibility
export async function collectSubreddit(
  subredditName: string,
  entities: TrackedEntity[],
  reddit: RedditClient
): Promise<NewIngestedItem[]> {
  return collectAllSubreddits([subredditName], entities, reddit);
}
