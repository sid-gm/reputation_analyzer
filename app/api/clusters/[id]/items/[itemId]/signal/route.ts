import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clusterItems } from "@/lib/db/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  const body = await req.json() as { signal: string | null };

  const allowed = ["signal", "noise", "watch", null];
  if (!allowed.includes(body.signal)) {
    return NextResponse.json({ error: "Invalid signal value" }, { status: 400 });
  }

  await db
    .update(clusterItems)
    .set({ analystSignal: body.signal })
    .where(and(eq(clusterItems.clusterId, id), eq(clusterItems.itemId, itemId)));

  return NextResponse.json({ ok: true });
}
