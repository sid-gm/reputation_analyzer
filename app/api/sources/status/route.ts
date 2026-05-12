import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hackernews: true,
    reddit: !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET),
    twitter: !!process.env.TWITTER_BEARER_TOKEN,
  });
}
