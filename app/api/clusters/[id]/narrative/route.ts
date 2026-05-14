import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clusters } from "@/lib/db/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { narrative } = await req.json();
  if (typeof narrative !== "string") {
    return NextResponse.json({ error: "narrative required" }, { status: 400 });
  }

  await db.update(clusters).set({ narrativeSummary: narrative }).where(eq(clusters.id, id));
  return NextResponse.json({ ok: true });
}
