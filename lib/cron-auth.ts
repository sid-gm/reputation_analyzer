import { NextResponse } from "next/server";

export function verifyCronSecret(req: Request): NextResponse | null {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
