import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function POST() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      ALTER TABLE tracked_entities
      ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE
    `);

    return NextResponse.json({ ok: true, message: "Migration applied" });
  } catch (err) {
    console.error("[POST /api/migrate]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
