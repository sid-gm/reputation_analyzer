import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clusters } from "@/lib/db/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as { classification: string | null; note?: string };

  const allowed = ["narrative", "noise", "signal", "watch", null];
  if (!allowed.includes(body.classification)) {
    return NextResponse.json({ error: "Invalid classification" }, { status: 400 });
  }

  await db
    .update(clusters)
    .set({
      analystClassification: body.classification,
      analystNote: body.note ?? null,
    })
    .where(eq(clusters.id, id));

  return NextResponse.json({ ok: true });
}
