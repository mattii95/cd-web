import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "./auth";

export type Role = "lector" | "admin";
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}; // DTO: nunca expone tokens ni el hash de la contraseña

// Lee la sesión una sola vez por request. Si la base falla, devuelve null.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const session = await getAuth().api.getSession({ headers: await headers() });
    if (!session) return null;
    const { id, name, email, role, createdAt } = session.user;
    return {
      id,
      name,
      email,
      role: role === "admin" ? "admin" : "lector",
      createdAt: new Date(createdAt),
    };
  } catch {
    return null;
  }
});

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
