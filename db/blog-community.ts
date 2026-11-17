import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { BlogRating } from "@/lib/blog-posts";
import {
  decodeCursor,
  encodeCursor,
  type Page,
  type PageParams,
  resolveLimit,
} from "@/lib/pagination";
import type { PublicComment } from "./blog";
import { getDb } from "./client";
import { comment, commentVote, post, postRating, user } from "./schema";

export type ViewerState = {
  rating: BlogRating | null; // su post_rating en este post
  votedCommentIds: string[]; // comentarios de este post que votó
  ownCommentIds: string[]; // sus comentarios aprobados en este post
  pending: PublicComment[]; // sus comentarios pendientes, createdAt descendente, máximo 20
  isPostAuthor: boolean; // post.author_id = userId
};

export type UserComment = {
  id: string;
  text: string;
  status: "pendiente" | "aprobado" | "oculto";
  createdAt: Date;
  post: { slug: string; title: string; published: boolean };
  reply: { text: string; repliedAt: Date } | null;
};

// Todos los comentarios del usuario, en cualquier estado y post. Sin caché.
export async function getUserComments(
  userId: string,
  params: PageParams = {},
): Promise<Page<UserComment>> {
  const limit = resolveLimit(params.limit, 20);
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  const rows = await getDb()
    .select({
      id: comment.id,
      text: comment.text,
      status: comment.status,
      createdAt: comment.createdAt,
      createdAtText: sql<string>`${comment.createdAt}::text`, // cursor: conserva los microsegundos
      replyText: comment.replyText,
      repliedAt: comment.repliedAt,
      slug: post.slug,
      title: post.title,
      postStatus: post.status,
    })
    .from(comment)
    .innerJoin(post, eq(post.id, comment.postId))
    .where(
      and(
        eq(comment.userId, userId),
        cursor
          ? sql`(${comment.createdAt}, ${comment.id}) < (${cursor.t}::timestamp, ${cursor.id})`
          : undefined,
      ),
    )
    .orderBy(desc(comment.createdAt), desc(comment.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map((r) => ({
      id: r.id,
      text: r.text,
      status: r.status,
      createdAt: r.createdAt,
      post: {
        slug: r.slug,
        title: r.title,
        published: r.postStatus === "publicado",
      },
      reply:
        r.replyText && r.repliedAt
          ? { text: r.replyText, repliedAt: r.repliedAt }
          : null,
    })),
    nextCursor:
      rows.length > limit
        ? encodeCursor({ t: last.createdAtText, id: last.id })
        : null,
  };
}

// Lo propio del lector en un post. Sin caché: depende de quién mira.
export async function getViewerState(
  postId: string,
  userId: string,
): Promise<ViewerState> {
  const db = getDb();
  const [ratingRow, voted, own, pending, authorRow] = await Promise.all([
    db
      .select({ rating: postRating.rating })
      .from(postRating)
      .where(and(eq(postRating.postId, postId), eq(postRating.userId, userId))),
    db
      .select({ id: commentVote.commentId })
      .from(commentVote)
      .innerJoin(comment, eq(comment.id, commentVote.commentId))
      .where(and(eq(commentVote.userId, userId), eq(comment.postId, postId))),
    db
      .select({ id: comment.id })
      .from(comment)
      .where(
        and(
          eq(comment.postId, postId),
          eq(comment.userId, userId),
          eq(comment.status, "aprobado"),
        ),
      ),
    db
      .select({
        id: comment.id,
        text: comment.text,
        createdAt: comment.createdAt,
        authorName: user.name,
        authorImage: user.image,
      })
      .from(comment)
      .innerJoin(user, eq(user.id, comment.userId))
      .where(
        and(
          eq(comment.postId, postId),
          eq(comment.userId, userId),
          eq(comment.status, "pendiente"),
        ),
      )
      .orderBy(desc(comment.createdAt), desc(comment.id))
      .limit(20),
    db
      .select({ id: post.id })
      .from(post)
      .where(and(eq(post.id, postId), eq(post.authorId, userId))),
  ]);
  const rating = (ratingRow[0]?.rating ?? null) as BlogRating | null;
  return {
    rating,
    votedCommentIds: voted.map((r) => r.id),
    ownCommentIds: own.map((r) => r.id),
    pending: pending.map((r) => ({
      ...r,
      rating,
      usefulCount: 0, // sin votos: solo se vota lo aprobado
      reply: null,
    })),
    isPostAuthor: authorRow.length > 0,
  };
}

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
