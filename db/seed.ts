import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const authorEmail = process.env.SEED_AUTHOR_EMAIL;
  if (!authorEmail) {
    throw new Error(
      "Falta SEED_AUTHOR_EMAIL en .env.local: el usuario tiene que estar registrado antes de correr el seed",
    );
  }
  // Import dinámico: el cliente lee DATABASE_URL, que loadEnvConfig acaba de cargar.
  const { closeDb, getDb } = await import("./client");
  const { seedBlog } = await import("./seed/blog");
  try {
    await seedBlog(getDb(), { authorEmail });
    console.log("seed: blog cargado");
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
