import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { getDb } from "./client";
import { getDatabaseUrl } from "./env";

export type DatabaseHealth = { ok: boolean };

// Nunca lanza: una base caída o mal configurada es { ok: false }.
// `url` opcional solo para tests: usa un pool propio y lo cierra.
export async function checkDatabase(url?: string): Promise<DatabaseHealth> {
  let pool: Pool | undefined;
  try {
    if (url) {
      pool = new Pool({ connectionString: url, connectionTimeoutMillis: 2000 });
      await pool.query("select 1");
    } else {
      getDatabaseUrl();
      await getDb().execute(sql`select 1`);
    }
    return { ok: true };
  } catch {
    return { ok: false };
  } finally {
    await pool?.end().catch(() => {});
  }
}
