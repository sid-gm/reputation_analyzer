export interface RedditPost {
  post_id: string;
  title: string;
  text: string;
  url: string;
  permalink: string;
  author: string;
  subreddit: string;
  created_utc_iso: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  engagement_level: string;
  score_per_hour: number;
  comments_per_hour: number;
  link_flair_text: string | null;
  is_controversial: boolean;
  [key: string]: unknown;
}

const APIFY_BASE = "https://api.apify.com/v2";

class RedditPostQuery {
  constructor(
    private subredditName: string,
    private limit: number,
    private token: string
  ) {}

  async all(): Promise<RedditPost[]> {
    const res = await fetch(
      `${APIFY_BASE}/acts/spry_wholemeal~reddit-scraper/run-sync-get-dataset-items?token=${this.token}&timeout=120&memory=512`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "scrape",
          scrape: {
            subreddits: [this.subredditName],
            sort: "new",
            maxPostsPerSubreddit: this.limit,
          },
        }),
      }
    );

    if (!res.ok) throw new Error(`Apify error: ${res.status}`);
    return res.json() as Promise<RedditPost[]>;
  }
}

export class RedditClient {
  private constructor(private token: string) {}

  static create(): RedditClient {
    const token = process.env.APIFY_TOKEN;
    if (!token) throw new Error("APIFY_TOKEN env var is not set");
    return new RedditClient(token);
  }

  getNewPosts(params: {
    subredditName: string;
    limit: number;
    pageSize: number;
  }): RedditPostQuery {
    return new RedditPostQuery(params.subredditName, params.limit, this.token);
  }
}
