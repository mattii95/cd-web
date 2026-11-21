// Solo para los E2E: los endpoints HTTP de registro están cerrados (disabledPaths),
// así que el helper crea usuarios por `auth.api`, igual que las Server Actions.
// Uso: tsx --conditions=react-server scripts/create-user.ts <email> <nombre> <contraseña>
// Lee DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL y SMTP_* del entorno.
async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error("Uso: create-user.ts <email> <nombre> <contraseña>");
    process.exit(1);
  }

  const { closeDb } = await import("../db/client");
  const { getAuth } = await import("../lib/auth/auth");
  try {
    await getAuth().api.signUpEmail({ body: { email, name, password } });
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
