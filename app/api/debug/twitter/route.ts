import { NextResponse } from "next/server";
import { getAllEntities } from "@/lib/collectors/ingest";

export async function GET() {
  const hasToken = !!process.env.TWITTER_BEARER_TOKEN;
  const tokenPreview = process.env.TWITTER_BEARER_TOKEN
    ? `${process.env.TWITTER_BEARER_TOKEN.slice(0, 8)}...`
    : null;

  const entities = await getAllEntities();

  const results = await Promise.all(
    entities.map(async (entity) => {
      const rawQuery = `${entity.queryString} -is:retweet lang:en`;
      const query = encodeURIComponent(rawQuery);
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=10&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username,name`;

      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}` },
        });
        const body = await res.json();
        return {
          entityId: entity.id,
          label: entity.label,
          queryString: entity.queryString,
          rawQuery,
          httpStatus: res.status,
          tweetCount: body.data?.length ?? 0,
          meta: body.meta,
          errors: body.errors ?? null,
          // show first tweet as a sample
          sample: body.data?.[0] ?? null,
        };
      } catch (err) {
        return {
          entityId: entity.id,
          label: entity.label,
          queryString: entity.queryString,
          rawQuery,
          httpStatus: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  return NextResponse.json({ hasToken, tokenPreview, entities: results });
}
