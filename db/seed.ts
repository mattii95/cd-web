import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";

async function main() {
  loadEnvConfig(process.cwd());
  // Import dinámico: el cliente lee DATABASE_URL, que loadEnvConfig acaba de cargar.
  const { closeDb, getDb } = await import("./client");
  try {
    await getDb().execute(sql`select 1`);
    // Cada spec suma acá sus datos iniciales (usuarios, posts, etc.).
    console.log("seed: conexión ok, sin datos para insertar");
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
