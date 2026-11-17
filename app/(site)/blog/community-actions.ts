"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import type { PublicComment } from "@/db/blog";
import {
  createComment,
  deleteOwnComment,
  deleteReply,
  saveReply,
  toggleVote,
  upsertRating,
} from "@/db/blog-community";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/dal";
import { isUserRateLimited } from "@/lib/auth/rate-limit";
import type { BlogRating } from "@/lib/blog-posts";

type Fail = { status: "error"; message: string };

const fail = (message: string): Fail => ({ status: "error", message });
const commentsTag = (postId: string) => `comments:${postId}`;

const idSchema = z.uuid();
const ratingSchema = z.number().int().min(1).max(5);
const textSchema = z.string().trim().min(2).max(2000);
const TEXT_ERROR = "El texto tiene que tener entre 2 y 2000 caracteres.";

// Sesión y red de seguridad comunes: las acciones nunca lanzan.
async function run<T>(
  failMessage: string,
  fn: (user: CurrentUser) => Promise<T | Fail>,
): Promise<T | Fail> {
  const user = await getCurrentUser();
  if (!user) return fail("Iniciá sesión para continuar.");
  try {
    return await fn(user);
  } catch {
    return fail(failMessage);
  }
}

export async function rateAction(
  postId: string,
  rating: number,
): Promise<{ status: "success" } | Fail> {
  const message = "No pudimos guardar tu valoración.";
  return run(message, async (user) => {
    const id = idSchema.safeParse(postId);
    const r = ratingSchema.safeParse(rating);
    if (!id.success || !r.success) return fail(message);
    if (!(await upsertRating(id.data, user.id, r.data as BlogRating))) {
      return fail(message);
    }
    updateTag(commentsTag(id.data));
    return { status: "success" };
  });
}

// No invalida la caché: el comentario nace pendiente y no está en ninguna lectura cacheada.
export async function createCommentAction(
  postId: string,
  text: string,
): Promise<{ status: "success"; comment: PublicComment } | Fail> {
  return run("No pudimos publicar tu comentario.", async (user) => {
    const id = idSchema.safeParse(postId);
    const t = textSchema.safeParse(text);
    if (!id.success) return fail("No pudimos publicar tu comentario.");
    if (!t.success) return fail(TEXT_ERROR);
    if (await isUserRateLimited("comment", user.id)) {
      return fail(
        "Publicaste varios comentarios seguidos. Probá de nuevo en unos minutos.",
      );
    }
    const comment = await createComment(id.data, user.id, t.data);
    if (!comment) return fail("No pudimos publicar tu comentario.");
    return { status: "success", comment };
  });
}

export async function deleteCommentAction(
  commentId: string,
): Promise<{ status: "success" } | Fail> {
  const message = "No pudimos borrar el comentario.";
  return run(message, async (user) => {
    const id = idSchema.safeParse(commentId);
    if (!id.success) return fail(message);
    const deleted = await deleteOwnComment(id.data, user.id);
    if (!deleted) return fail(message);
    updateTag(commentsTag(deleted.postId));
    return { status: "success" };
  });
}

// No invalida la caché: el cliente ajusta el contador con el conteo real que devuelve.
export async function toggleVoteAction(
  commentId: string,
): Promise<{ status: "success"; voted: boolean; usefulCount: number } | Fail> {
  const message = "No pudimos registrar tu voto.";
  return run(message, async (user) => {
    const id = idSchema.safeParse(commentId);
    if (!id.success) return fail(message);
    const res = await toggleVote(id.data, user.id);
    return res ? { status: "success", ...res } : fail(message);
  });
}

export async function saveReplyAction(
  commentId: string,
  text: string,
): Promise<
  { status: "success"; reply: { text: string; repliedAt: Date } } | Fail
> {
  const message = "No pudimos guardar la respuesta.";
  return run(message, async (user) => {
    const id = idSchema.safeParse(commentId);
    const t = textSchema.safeParse(text);
    if (!id.success) return fail(message);
    if (!t.success) return fail(TEXT_ERROR);
    const saved = await saveReply(id.data, user.id, t.data);
    if (!saved) return fail(message);
    updateTag(commentsTag(saved.postId));
    return {
      status: "success",
      reply: { text: t.data, repliedAt: saved.repliedAt },
    };
  });
}

export async function deleteReplyAction(
  commentId: string,
): Promise<{ status: "success" } | Fail> {
  const message = "No pudimos guardar la respuesta.";
  return run(message, async (user) => {
    const id = idSchema.safeParse(commentId);
    if (!id.success) return fail(message);
    const deleted = await deleteReply(id.data, user.id);
    if (!deleted) return fail(message);
    updateTag(commentsTag(deleted.postId));
    return { status: "success" };
  });
}
