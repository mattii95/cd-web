import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { account, user } from "@/db/schema";

// Evita el robo de cuenta previo: si alguien registró con contraseña un email ajeno (sin verificar)
// y la dueña real entra con un proveedor, la contraseña del registro se borra antes de vincular.
export async function removeUnverifiedPassword(userId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, userId));
  if (!row || row.emailVerified) return;
  await db
    .delete(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
}
