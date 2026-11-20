import "server-only";
import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { getDb } from "@/db/client";
import { user } from "@/db/schema";

export const SUSPENDED_CODE = "ACCOUNT_SUSPENDED";

// Lectura por clave primaria; solo corre al crear una sesión (login), no en cada request.
export async function assertNotSuspended(userId: string): Promise<void> {
  const [row] = await getDb()
    .select({ bannedAt: user.bannedAt })
    .from(user)
    .where(eq(user.id, userId));
  if (row?.bannedAt) throw new APIError("FORBIDDEN", { code: SUSPENDED_CODE, message: SUSPENDED_CODE });
}
