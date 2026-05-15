import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const renameSchema = z.object({ name: z.string().min(1) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(companies)
      .set({ name: parsed.data.name })
      .where(eq(companies.id, id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/companies/[id]]", err);
    return NextResponse.json({ error: "Failed to rename company" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.delete(companies).where(eq(companies.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/companies/[id]]", err);
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 });
  }
}
