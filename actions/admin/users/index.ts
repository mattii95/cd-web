"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import {
  banUser,
  deleteUser,
  getUserForVerification,
  revokeUserSessions,
  unbanUser,
} from "@/db/admin-users";
import { getAuth } from "@/lib/auth/auth";
import { requireAdmin } from "@/lib/auth/dal";
import { parseBanForm } from "@/lib/admin/user-form";

export type UserActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message?: string; fieldErrors?: Partial<Record<"reason" | "confirmEmail", string>> };

const MSG = {
  banned: (name: string, n: number) =>
    `${name} quedó bloqueado. ${n === 1 ? "Se cerró 1 sesión" : `Se cerraron ${n} sesiones`}.`,
  unbanned: (name: string) => `${name} ya puede volver a iniciar sesión.`,
  revoked: (name: string, n: number) =>
    `${n === 1 ? "Se cerró 1 sesión" : `Se cerraron ${n} sesiones`} de ${name}.`,
  resent: (email: string) => `Le reenviamos el email de verificación a ${email}.`,
  deleted: (name: string) => `Se borró la cuenta de ${name}.`,
  mismatch: "El email no coincide.",
  admin: "No se puede hacer esto con un administrador.",
  self: "Para cerrar tu sesión usá «Cerrar sesión».",
  author: (n: number) => `No se puede borrar: es autor de ${n === 1 ? "1 artículo" : `${n} artículos`}.`,
  alreadyBanned: "Ese usuario ya estaba bloqueado.",
  notBanned: "Ese usuario no está bloqueado.",
  verified: "Ese usuario ya no necesita verificar su email.",
  gone: "Ese usuario ya no existe.",
  db: "No pudimos completar la acción. Intentá de nuevo en unos minutos.",
};

const error = (message: string): UserActionState => ({ status: "error", message });
const ok = (message: string): UserActionState => {
  revalidatePath("/admin/users");
  return { status: "success", message };
};

const idSchema = z.string().trim().min(1).max(200);
const readId = (data: FormData) => idSchema.safeParse(data.get("id"));

type Failure = { reason: "not-found" | "protected" | "already" | "not-banned" };
function fail(res: Failure): UserActionState {
  switch (res.reason) {
    case "protected":
      return error(MSG.admin);
    case "already":
      return error(MSG.alreadyBanned);
    case "not-banned":
      return error(MSG.notBanned);
    default:
      return error(MSG.gone);
  }
}

export async function banUserAction(_: UserActionState, data: FormData): Promise<UserActionState> {
  const admin = await requireAdmin();

  const parsed = parseBanForm(data);
  if (!parsed.ok) {
    const { id, reason } = parsed.fieldErrors;
    return id ? error(id) : { status: "error", fieldErrors: { reason } };
  }
  try {
    const res = await banUser(parsed.id, parsed.reason, admin.id);
    return res.ok ? ok(MSG.banned(res.name, res.revoked)) : fail(res);
  } catch {
    return error(MSG.db);
  }
}

export async function unbanUserAction(_: UserActionState, data: FormData): Promise<UserActionState> {
  await requireAdmin();
  const id = readId(data);
  if (!id.success) return error(MSG.gone);
  try {
    const res = await unbanUser(id.data);
    return res.ok ? ok(MSG.unbanned(res.name)) : fail(res);
  } catch {
    return error(MSG.db);
  }
}

export async function revokeUserSessionsAction(
  _: UserActionState,
  data: FormData,
): Promise<UserActionState> {
  const admin = await requireAdmin();
  const id = readId(data);
  if (!id.success) return error(MSG.gone);
  if (id.data === admin.id) return error(MSG.self);
  try {
    const res = await revokeUserSessions(id.data);
    return res.ok ? ok(MSG.revoked(res.name, res.revoked)) : fail(res);
  } catch {
    return error(MSG.db);
  }
}

export async function resendUserVerificationAction(
  _: UserActionState,
  data: FormData,
): Promise<UserActionState> {
  await requireAdmin();
  const id = readId(data);
  if (!id.success) return error(MSG.gone);
  try {
    const target = await getUserForVerification(id.data);
    if (!target) return error(MSG.gone);
    if (target.emailVerified || target.bannedAt) return error(MSG.verified);
    // Sin headers: con la cookie del admin, Better Auth lo toma como una sesión y rechaza
    // el pedido porque el email del destino no es el suyo.
    await getAuth().api.sendVerificationEmail({
      body: { email: target.email, callbackURL: "/cuenta/verificar?estado=ok" },
    });
    return ok(MSG.resent(target.email));
  } catch {
    return error(MSG.db);
  }
}

export async function deleteUserAction(_: UserActionState, data: FormData): Promise<UserActionState> {
  await requireAdmin();
  const id = readId(data);
  if (!id.success) return error(MSG.gone);
  const confirmEmail = z.string().max(320).catch("").parse(data.get("confirmEmail"));
  try {
    const res = await deleteUser(id.data, confirmEmail);
    if (res.ok) {
      // Sus comentarios y puntuaciones salen en el blog público.
      updateTag("blog");
      return ok(MSG.deleted(res.name));
    }
    if (res.reason === "author") return error(MSG.author(res.posts));
    if (res.reason === "mismatch")
      return { status: "error", fieldErrors: { confirmEmail: MSG.mismatch } };
    return fail(res);
  } catch {
    return error(MSG.db);
  }
}
