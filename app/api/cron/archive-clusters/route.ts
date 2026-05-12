import { NextResponse } from "next/server";
import { and, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { clusters } from "@/lib/db/schema";
import { verifyCronSecret } from "@/lib/cron-auth";

const ARCHIVE_AFTER_DAYS = 90;

export async function GET(req: Request) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ARCHIVE_AFTER_DAYS);

  try {
    const result = await db
      .update(clusters)
      .set({ archivedAt: new Date() })
      .where(and(isNull(clusters.archivedAt), lt(clusters.lastSeenAt, cutoff)))
      .returning({ id: clusters.id });

    return NextResponse.json({ ok: true, archived: result.length });
  } catch (err) {
    console.error("[archive-clusters]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
