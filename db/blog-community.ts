import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { BlogRating } from "@/lib/blog-posts";
import type { PublicComment } from "./blog";
import { getDb } from "./client";
import { comment, commentVote, post, postRating, user } from "./schema";

// Escrituras de la comunidad. Un permiso que no se cumple devuelve null o false, no lanza.

async function isPublished(postId: string) {
  const [row] = await getDb()
    .select({ id: post.id })
    .from(post)
    .where(and(eq(post.id, postId), eq(post.status, "publicado")));
  return !!row;
}

// Comentario aprobado de un post publicado; con `authorId`, además el post es de ese usuario.
const approvedInPublished = (authorId?: string) =>
  sql`${comment.status} = 'aprobado' and exists (select 1 from ${post} where ${post.id} = ${comment.postId} and ${post.status} = 'publicado'${authorId ? sql` and ${post.authorId} = ${authorId}` : sql``})`;

export async function upsertRating(
  postId: string,
  userId: string,
  rating: BlogRating,
): Promise<boolean> {
  if (!(await isPublished(postId))) return false;
  await getDb()
    .insert(postRating)
    .values({ postId, userId, rating })
    .onConflictDoUpdate({
      target: [postRating.postId, postRating.userId],
      set: { rating },
    });
  return true;
}

export async function createComment(
  postId: string,
  userId: string,
  text: string,
): Promise<PublicComment | null> {
  const db = getDb();
  if (!(await isPublished(postId))) return null;

  const [row] = await db
    .insert(comment)
    .values({ postId, userId, text: text.trim() })
    .returning();
  const [author] = await db
    .select({
      name: user.name,
      image: user.image,
      rating: postRating.rating,
    })
    .from(user)
    .leftJoin(
      postRating,
      and(eq(postRating.postId, postId), eq(postRating.userId, userId)),
    )
    .where(eq(user.id, userId));
  return {
    id: row.id,
    authorName: author.name,
    authorImage: author.image,
    rating: author.rating as BlogRating | null,
    text: row.text,
    usefulCount: 0,
    createdAt: row.createdAt,
    reply: null,
  };
}

// Sin chequear el estado del post ni del comentario: el usuario siempre puede borrar lo suyo.
export async function deleteOwnComment(
  commentId: string,
  userId: string,
): Promise<{ postId: string } | null> {
  const [row] = await getDb()
    .delete(comment)
    .where(and(eq(comment.id, commentId), eq(comment.userId, userId)))
    .returning({ postId: comment.postId });
  return row ?? null;
}

export async function toggleVote(
  commentId: string,
  userId: string,
): Promise<{ voted: boolean; usefulCount: number } | null> {
  return getDb().transaction(async (tx) => {
    const [target] = await tx
      .select({ id: comment.id })
      .from(comment)
      .where(
        and(
          eq(comment.id, commentId),
          sql`${comment.userId} <> ${userId}`,
          approvedInPublished(),
        ),
      );
    if (!target) return null;

    const removed = await tx
      .delete(commentVote)
      .where(
        and(
          eq(commentVote.commentId, commentId),
          eq(commentVote.userId, userId),
        ),
      )
      .returning({ userId: commentVote.userId });
    if (removed.length === 0) {
      await tx
        .insert(commentVote)
        .values({ commentId, userId })
        .onConflictDoNothing();
    }
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(commentVote)
      .where(eq(commentVote.commentId, commentId));
    return { voted: removed.length === 0, usefulCount: count };
  });
}

export async function saveReply(
  commentId: string,
  userId: string,
  text: string,
): Promise<{ postId: string; repliedAt: Date } | null> {
  const [row] = await getDb()
    .update(comment)
    .set({ replyText: text.trim(), repliedAt: new Date() })
    .where(and(eq(comment.id, commentId), approvedInPublished(userId)))
    .returning({ postId: comment.postId, repliedAt: comment.repliedAt });
  return row ? { postId: row.postId, repliedAt: row.repliedAt! } : null;
}

// Sigue la tabla de permisos: no exige comentario aprobado, solo que tenga respuesta.
export async function deleteReply(
  commentId: string,
  userId: string,
): Promise<{ postId: string } | null> {
  const [row] = await getDb()
    .update(comment)
    .set({ replyText: null, repliedAt: null })
    .where(
      and(
        eq(comment.id, commentId),
        sql`${comment.replyText} is not null`,
        sql`exists (select 1 from ${post} where ${post.id} = ${comment.postId} and ${post.status} = 'publicado' and ${post.authorId} = ${userId})`,
      ),
    )
    .returning({ postId: comment.postId });
  return row ?? null;
}
