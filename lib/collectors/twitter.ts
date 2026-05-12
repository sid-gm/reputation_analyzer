import type { NewIngestedItem, TrackedEntity } from "@/lib/db/schema";

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  [key: string]: unknown;
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

export async function collectTwitter(
  entity: TrackedEntity
): Promise<NewIngestedItem[]> {
  // For executives, support "from:handle" syntax in queryString
  const query = encodeURIComponent(
    `${entity.queryString} -is:retweet lang:en`
  );

  const res = await fetch(
    `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=25&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username,name`,
    {
      headers: {
        Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
      },
    }
  );

  if (!res.ok) throw new Error(`Twitter API error: ${res.status}`);

  const data = (await res.json()) as {
    data?: Tweet[];
    includes?: { users?: TwitterUser[] };
  };

  if (!data.data) return [];

  const usersById = new Map(
    (data.includes?.users ?? []).map((u) => [u.id, u])
  );

  return data.data.map((tweet) => {
    const user = usersById.get(tweet.author_id);
    return {
      entityId: entity.id,
      platform: "twitter" as const,
      externalId: tweet.id,
      url: `https://twitter.com/i/web/status/${tweet.id}`,
      title: null,
      body: tweet.text,
      author: user ? `@${user.username}` : tweet.author_id,
      publishedAt: new Date(tweet.created_at),
      rawJson: tweet,
    };
  });
}
