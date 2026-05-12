import type { NewIngestedItem, TrackedEntity } from "@/lib/db/schema";

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  author: string;
  created_utc: number;
  permalink: string;
  [key: string]: unknown;
}

async function getRedditToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "STNAnalyzer/1.0",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Reddit auth error: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function collectReddit(
  entity: TrackedEntity
): Promise<NewIngestedItem[]> {
  const token = await getRedditToken();
  const query = encodeURIComponent(entity.queryString);

  const res = await fetch(
    `https://oauth.reddit.com/search?q=${query}&sort=new&limit=25&type=link`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "STNAnalyzer/1.0",
      },
    }
  );

  if (!res.ok) throw new Error(`Reddit API error: ${res.status}`);

  const data = (await res.json()) as {
    data: { children: Array<{ data: RedditPost }> };
  };

  return data.data.children.map(({ data: post }) => ({
    entityId: entity.id,
    platform: "reddit" as const,
    externalId: post.id,
    url: `https://reddit.com${post.permalink}`,
    title: post.title,
    body: post.selftext || null,
    author: post.author,
    publishedAt: new Date(post.created_utc * 1000),
    rawJson: post,
  }));
}
