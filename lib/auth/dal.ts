import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { account } from "@/db/schema";
import { getAuth } from "./auth";
import type { SocialProvider } from "./providers";

export type Role = "lector" | "admin";
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  createdAt: Date;
}; // DTO: nunca expone tokens ni el hash de la contraseña

// Lee la sesión una sola vez por request. Si la base falla, devuelve null.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Fuera del try: connection() posterga la página al request. Si lo tragara el catch
  // (p. ej. porque getAuth() falla sin variables en el build), el redirect a login
  // quedaría horneado en el HTML estático. Con partialPrefetching, headers() se resuelve
  // en el App Shell y ya no posterga; connection() hace falta porque better-auth usa
  // `new Date()` para validar la expiración de la sesión.
  const requestHeaders = await headers();
  await connection();
  try {
    const session = await getAuth().api.getSession({ headers: requestHeaders });
    if (!session) return null;
    const { id, name, email, image, role, createdAt, bannedAt } = session.user;
    // Segunda barrera: una sesión creada justo antes del bloqueo no sirve.
    if (bannedAt) return null;
    return {
      id,
      name,
      email,
      image: image ?? null,
      role: role === "admin" ? "admin" : "lector",
      createdAt: new Date(createdAt),
    };
  } catch {
    return null;
  }
});

export type LoginMethod = "credential" | SocialProvider;
const METHOD_ORDER: LoginMethod[] = ["credential", "google", "github", "microsoft"];

// Solo devuelve el providerId de cada fila de `account`: nunca tokens ni el hash de la contraseña.
export async function getLoginMethods(userId: string): Promise<LoginMethod[]> {
  const rows = await getDb()
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, userId));
  const ids = new Set(rows.map((r) => r.providerId));
  return METHOD_ORDER.filter((m) => ids.has(m));
}

export async function requireUser(volver: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/cuenta/login?volver=${encodeURIComponent(volver)}`);
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") notFound();
  return user;
}
