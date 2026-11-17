import { execFileSync } from "node:child_process";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { clearRateLimit, sql } from "./helpers";

export const E2E_AUTHOR = "autor-e2e@example.com";

// Deja la base de test migrada, con el blog cargado y sin límites de intentos acumulados.
export default async function globalSetup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await migrate(drizzle(pool), { migrationsFolder: "./db/migrations" });
  await pool.end();
  await clearRateLimit();

  // Autor del seed: solo la fila de usuario, no inicia sesión.
  await sql(
    `insert into "user" (id, name, email, email_verified)
     values ('autor-e2e', 'Matías Courroux', $1, true)
     on conflict (email) do nothing`,
    [E2E_AUTHOR],
  );

  // Mismo comando que `npm run db:seed` (necesita la condición react-server por server-only).
  // Hereda DATABASE_URL y MEDIA_DIR: las imágenes quedan donde las lee el servidor de E2E.
  execFileSync("npx", ["tsx", "--conditions=react-server", "db/seed.ts"], {
    env: { ...process.env, SEED_AUTHOR_EMAIL: E2E_AUTHOR },
    stdio: "inherit",
  });
}
