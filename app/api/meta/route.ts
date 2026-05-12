import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "STNAnalyzer/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();

    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
    const author =
      html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i)?.[1]?.trim() ??
      null;

    return NextResponse.json({ title, author });
  } catch {
    return NextResponse.json({ title: null, author: null });
  }
}
