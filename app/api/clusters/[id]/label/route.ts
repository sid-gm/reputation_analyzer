import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clusters } from "@/lib/db/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { label } = await req.json();
  if (label !== null && typeof label !== "string") {
    return NextResponse.json({ error: "label must be a string or null" }, { status: 400 });
  }

  await db.update(clusters).set({ label: label || null }).where(eq(clusters.id, id));
  return NextResponse.json({ ok: true });
}
