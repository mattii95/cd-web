import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDatabaseUrl } from "./env";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

// En desarrollo las recargas de Turbopack reevalúan el módulo: el pool vive en globalThis.
const globalForDb = globalThis as unknown as {
  __dbPool?: Pool;
  __db?: Db;
};

let pool = globalForDb.__dbPool;
let db = globalForDb.__db;

export function getDb(): Db {
  if (!db) {
    pool = new Pool({ connectionString: getDatabaseUrl() });
    db = drizzle(pool, { schema, casing: "snake_case" });
    if (process.env.NODE_ENV !== "production") {
      globalForDb.__dbPool = pool;
      globalForDb.__db = db;
    }
  }
  return db;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = db = globalForDb.__dbPool = globalForDb.__db = undefined;
}
