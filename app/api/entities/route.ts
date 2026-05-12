import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackedEntities } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  label: z.string().min(1),
  queryString: z.string().min(1),
  entityType: z.enum(["keyword", "executive", "product"]),
  googleAlertsFeedUrl: z.string().url().optional().or(z.literal("")),
});

export async function GET() {
  try {
    const entities = await db
      .select()
      .from(trackedEntities)
      .orderBy(asc(trackedEntities.createdAt));
    return NextResponse.json(entities);
  } catch (err) {
    console.error("[GET /api/entities]", err);
    return NextResponse.json({ error: "Failed to load entities" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { label, queryString, entityType, googleAlertsFeedUrl } = parsed.data;
  try {
    const [entity] = await db
      .insert(trackedEntities)
      .values({
        label,
        queryString,
        entityType,
        googleAlertsFeedUrl: googleAlertsFeedUrl || null,
      })
      .returning();
    return NextResponse.json(entity, { status: 201 });
  } catch (err) {
    console.error("[POST /api/entities]", err);
    return NextResponse.json({ error: "Failed to save entity" }, { status: 500 });
  }
}
