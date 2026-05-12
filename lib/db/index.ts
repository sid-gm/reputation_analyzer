import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DB | undefined;

function getInstance(): DB {
  if (!_db) {
    // neon-http requires the direct (non-pooled) endpoint; pooled URLs go through PgBouncer which doesn't support Neon's HTTP query API
    const url =
      process.env.sma_DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.sma_DATABASE_URL ??
      process.env.DATABASE_URL;
    if (!url) throw new Error("No database URL found in environment");
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}

// Proxy defers initialization to first real call — safe during Next.js build-time static analysis
export const db: DB = new Proxy({} as DB, {
  get(_, prop: string | symbol) {
    return (getInstance() as never)[prop];
  },
});
