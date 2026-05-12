import type { NewIngestedItem, TrackedEntity } from "@/lib/db/schema";
import { RedditClient } from "./reddit-client";

export { RedditClient };

export async function collectSubreddit(
  subredditName: string,
  entities: TrackedEntity[],
  reddit: RedditClient
): Promise<NewIngestedItem[]> {
  const posts = await reddit
    .getNewPosts({ subredditName, limit: 100, pageSize: 100 })
    .all();

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
