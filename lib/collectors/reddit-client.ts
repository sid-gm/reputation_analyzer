export interface RedditPost {
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

class RedditPostQuery {
  constructor(
    private subredditName: string,
    private limit: number,
    private pageSize: number,
    private token: string
  ) {}

  async all(): Promise<RedditPost[]> {
    const results: RedditPost[] = [];
    let after: string | undefined;

    while (results.length < this.limit) {
      const batchSize = Math.min(this.pageSize, this.limit - results.length, 100);
      const params = new URLSearchParams({
        limit: String(batchSize),
        ...(after ? { after } : {}),
      });

      const res = await fetch(
        `https://oauth.reddit.com/r/${this.subredditName}/new?${params}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "User-Agent": "STNAnalyzer/1.0",
          },
        }
      );

      if (!res.ok) throw new Error(`Reddit API error: ${res.status}`);

      const data = (await res.json()) as {
        data: { children: Array<{ data: RedditPost }>; after: string | null };
      };

      const posts = data.data.children.map((c) => c.data);
      results.push(...posts);
      after = data.data.after ?? undefined;

      if (!after || posts.length === 0) break;
    }

    return results.slice(0, this.limit);
  }
}

export class RedditClient {
  private constructor(private token: string) {}

  static async create(): Promise<RedditClient> {
    const token = await getRedditToken();
    return new RedditClient(token);
  }

  getNewPosts(params: {
    subredditName: string;
    limit: number;
    pageSize: number;
  }): RedditPostQuery {
    return new RedditPostQuery(
      params.subredditName,
      params.limit,
      params.pageSize,
      this.token
    );
  }
}
