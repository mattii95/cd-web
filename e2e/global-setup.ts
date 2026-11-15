import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { clearRateLimit } from "./helpers";

// Deja la base de test migrada y sin límites de intentos acumulados.
export default async function globalSetup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await migrate(drizzle(pool), { migrationsFolder: "./db/migrations" });
  await pool.end();
  await clearRateLimit();
}
