"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import {
  deleteCommentAsAdmin,
  restoreCommentsStatus,
  setCommentsStatus,
  type CommentStatus,
} from "@/db/admin-comments";
import { requireAdmin } from "@/lib/auth/dal";

export type CommentActionState =
  | { status: "idle" }
  | {
      status: "success";
      message: string;
      undo?: { id: string; status: CommentStatus }[];
    }
  | { status: "error"; message?: string };

const MAX_BATCH = 25;

const MSG = {
  approved: (n: number) => (n === 1 ? "Comentario aprobado." : `Se aprobaron ${n} comentarios.`),
  hidden: (n: number) => (n === 1 ? "Comentario oculto." : `Se ocultaron ${n} comentarios.`),
  alreadyApproved: "Esos comentarios ya estaban aprobados.",
  alreadyHidden: "Esos comentarios ya estaban ocultos.",
  undone: "Se deshizo el cambio.",
  deleted: "Comentario borrado.",
  gone: "Ese comentario ya no existe.",
  generic: "No pudimos completar la acción. Intentá de nuevo en unos minutos.",
};

const error = (message: string): CommentActionState => ({ status: "error", message });

// Invalida el blog público de cada artículo afectado y refresca la lista del panel.
function invalidate(postIds: Iterable<string>) {
  for (const postId of new Set(postIds)) updateTag(`comments:${postId}`);
  revalidatePath("/admin/comments");
}

const idSchema = z.uuid();
const setSchema = z.object({
  ids: z.array(idSchema).min(1).max(MAX_BATCH),
  status: z.enum(["aprobado", "oculto"]),
});
const undoSchema = z
  .array(z.object({ id: idSchema, status: z.enum(["pendiente", "aprobado", "oculto"]) }))
  .min(1)
  .max(MAX_BATCH);

export async function setCommentStatusAction(
  _: CommentActionState,
  data: FormData,
): Promise<CommentActionState> {
  await requireAdmin();

  const parsed = setSchema.safeParse({ ids: data.getAll("id"), status: data.get("status") });
  if (!parsed.success) return error(MSG.generic);
  const { status } = parsed.data;
  const ids = [...new Set(parsed.data.ids)];

  try {
    const res = await setCommentsStatus(ids, status);
    if (!res.ok) return error(MSG.gone);
    const n = res.changed.length;
    if (n === 0) {
      return {
        status: "success",
        message: status === "aprobado" ? MSG.alreadyApproved : MSG.alreadyHidden,
      };
    }
    invalidate(res.changed.map((c) => c.postId));
    return {
      status: "success",
      message: status === "aprobado" ? MSG.approved(n) : MSG.hidden(n),
      undo: res.changed.map((c) => ({ id: c.id, status: c.previous })),
    };
  } catch {
    return error(MSG.generic);
  }
}

export async function undoCommentStatusAction(
  items: { id: string; status: CommentStatus }[],
): Promise<CommentActionState> {
  await requireAdmin();

  const parsed = undoSchema.safeParse(items);
  if (!parsed.success) return error(MSG.generic);

  try {
    const res = await restoreCommentsStatus(parsed.data);
    if (!res.ok) return error(MSG.gone);
    invalidate(res.postIds);
    return { status: "success", message: MSG.undone };
  } catch {
    return error(MSG.generic);
  }
}

export async function deleteCommentAsAdminAction(
  _: CommentActionState,
  data: FormData,
): Promise<CommentActionState> {
  await requireAdmin();

  const id = idSchema.safeParse(data.get("id"));
  if (!id.success) return error(MSG.generic);

  try {
    const res = await deleteCommentAsAdmin(id.data);
    if (!res.ok) return error(MSG.gone);
    invalidate([res.postId]);
    return { status: "success", message: MSG.deleted };
  } catch {
    return error(MSG.generic);
  }
}
