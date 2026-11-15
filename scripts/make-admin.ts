import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Uso: npm run auth:make-admin -- usuario@email.com");
    process.exit(1);
  }

  loadEnvConfig(process.cwd());
  // Import dinámico: el cliente lee DATABASE_URL, que loadEnvConfig acaba de cargar.
  const { closeDb, getDb } = await import("../db/client");
  const { user } = await import("../db/schema");
  try {
    const updated = await getDb()
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.email, email))
      .returning({ email: user.email });
    if (updated.length === 0) {
      console.error(`No existe un usuario con el email ${email}.`);
      process.exit(1);
    }
    console.log(`${email} ahora es admin.`);
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
