import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

let pool: Pool | undefined;

export async function setup() {
  loadEnvConfig(process.cwd());

  const url = process.env.DATABASE_URL;
  const dbName = url ? new URL(url).pathname.slice(1) : "";
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `test:db necesita DATABASE_URL apuntando a una base "_test" (hoy: "${dbName || "sin definir"}"). ` +
        'Definila en .env.test.local. Si la base no existe: CREATE DATABASE "DB_CD26_test";',
    );
  }

  pool = new Pool({ connectionString: url });
  await migrate(drizzle(pool), { migrationsFolder: "./db/migrations" });
}

export async function teardown() {
  await pool?.end();
}
