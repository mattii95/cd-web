import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { COMMENTS_PER_PAGE, type AdminCommentQuery } from "@/lib/admin/comment-params";
import { getDb } from "./client";
import { comment, post, user } from "./schema";

// Consultas del panel: sin caché. Quien escribe invalida `comments:<postId>` (ver la action).

export type CommentStatus = "pendiente" | "aprobado" | "oculto";
export type AdminCommentRow = {
  id: string;
  text: string;
  status: CommentStatus;
  createdAt: Date;
  usefulCount: number;
  reply: { text: string; repliedAt: Date } | null;
  author: { id: string; name: string; email: string; image: string | null };
  post: { id: string; title: string; slug: string; published: boolean };
};
export type AdminCommentList = {
  items: AdminCommentRow[];
  total: number; // con estado, artículo y búsqueda
  page: number; // acotada a [1, pageCount]
  pageCount: number; // ≥ 1
  counts: Record<CommentStatus, number>; // con artículo y búsqueda, sin estado
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

const STATUS_OF = {
  pendientes: "pendiente",
  aprobados: "aprobado",
  ocultos: "oculto",
} as const;

// Artículo y búsqueda: lo que comparten las filas y las cantidades por pestaña.
function baseWhere({ articulo, q }: Pick<AdminCommentQuery, "articulo" | "q">): SQL | undefined {
  const pattern = q ? `%${escapeLike(q)}%` : null;
  return and(
    articulo ? eq(comment.postId, articulo) : undefined,
    pattern
      ? or(ilike(comment.text, pattern), ilike(user.name, pattern), ilike(user.email, pattern))
      : undefined,
  );
}

export async function listAdminComments(query: AdminCommentQuery): Promise<AdminCommentList> {
  const db = getDb();
  const base = baseWhere(query);

  const grouped = await db
    .select({ status: comment.status, n: count() })
    .from(comment)
    .innerJoin(user, eq(user.id, comment.userId))
    .where(base)
    .groupBy(comment.status);
  const counts: Record<CommentStatus, number> = { pendiente: 0, aprobado: 0, oculto: 0 };
  for (const g of grouped) counts[g.status] = g.n;

  const status = query.estado === "todos" ? null : STATUS_OF[query.estado];
  const total = status ? counts[status] : counts.pendiente + counts.aprobado + counts.oculto;
  const pageCount = Math.max(1, Math.ceil(total / COMMENTS_PER_PAGE));
  const page = Math.min(query.page, pageCount);

  // Pendientes: en orden de llegada. El resto, lo más nuevo primero. id desempata.
  const order =
    query.estado === "pendientes"
      ? [asc(comment.createdAt), asc(comment.id)]
      : [desc(comment.createdAt), desc(comment.id)];

  const rows = await db
    .select({
      id: comment.id,
      text: comment.text,
      status: comment.status,
      createdAt: comment.createdAt,
      replyText: comment.replyText,
      repliedAt: comment.repliedAt,
      // Subconsulta correlacionada: corre solo sobre las filas de la página.
      usefulCount: sql<number>`(select count(*)::int from comment_vote where comment_vote.comment_id = ${comment.id})`,
      authorId: user.id,
      authorName: user.name,
      authorEmail: user.email,
      authorImage: user.image,
      postId: post.id,
      postTitle: post.title,
      postSlug: post.slug,
      postStatus: post.status,
    })
    .from(comment)
    .innerJoin(user, eq(user.id, comment.userId))
    .innerJoin(post, eq(post.id, comment.postId))
    .where(and(base, status ? eq(comment.status, status) : undefined))
    .orderBy(...order)
    .limit(COMMENTS_PER_PAGE)
    .offset((page - 1) * COMMENTS_PER_PAGE);

  const items: AdminCommentRow[] = rows.map((r) => ({
    id: r.id,
    text: r.text,
    status: r.status,
    createdAt: r.createdAt,
    usefulCount: r.usefulCount,
    reply: r.replyText && r.repliedAt ? { text: r.replyText, repliedAt: r.repliedAt } : null,
    author: { id: r.authorId, name: r.authorName, email: r.authorEmail, image: r.authorImage },
    post: { id: r.postId, title: r.postTitle, slug: r.postSlug, published: r.postStatus === "publicado" },
  }));
  return { items, total, page, pageCount, counts };
}

// Artículos con al menos un comentario, de cualquier estado, por título.
export async function listCommentedPosts(): Promise<{ id: string; title: string }[]> {
  return getDb()
    .selectDistinct({ id: post.id, title: post.title })
    .from(post)
    .innerJoin(comment, eq(comment.postId, post.id))
    .orderBy(asc(post.title), asc(post.id));
}

export async function countPendingComments(): Promise<number> {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(comment)
    .where(eq(comment.status, "pendiente"));
  return n;
}

type Change = { id: string; postId: string; previous: CommentStatus };

// changed solo trae los que tenían otro estado; "not-found" si ningún id existe.
export async function setCommentsStatus(
  ids: string[],
  status: "aprobado" | "oculto",
): Promise<{ ok: true; changed: Change[] } | { ok: false; reason: "not-found" }> {
  return getDb().transaction(async (tx) => {
    const found = await tx
      .select({ id: comment.id, postId: comment.postId, status: comment.status })
      .from(comment)
      .where(inArray(comment.id, ids))
      .for("update");
    if (found.length === 0) return { ok: false as const, reason: "not-found" as const };

    const changed = found
      .filter((c) => c.status !== status)
      .map((c) => ({ id: c.id, postId: c.postId, previous: c.status }));
    if (changed.length > 0) {
      await tx
        .update(comment)
        .set({ status })
        .where(
          inArray(
            comment.id,
            changed.map((c) => c.id),
          ),
        );
    }
    return { ok: true as const, changed };
  });
}

// Devuelve cada comentario a su estado anterior (incluido `pendiente`).
// postIds trae los artículos de los comentarios que existen.
export async function restoreCommentsStatus(
  items: { id: string; status: CommentStatus }[],
): Promise<{ ok: true; postIds: string[] } | { ok: false; reason: "not-found" }> {
  return getDb().transaction(async (tx) => {
    const found = await tx
      .select({ id: comment.id, postId: comment.postId })
      .from(comment)
      .where(
        inArray(
          comment.id,
          items.map((i) => i.id),
        ),
      )
      .for("update");
    if (found.length === 0) return { ok: false as const, reason: "not-found" as const };

    const existing = new Set(found.map((c) => c.id));
    for (const status of ["pendiente", "aprobado", "oculto"] as const) {
      const group = items.filter((i) => i.status === status && existing.has(i.id));
      if (group.length === 0) continue;
      await tx
        .update(comment)
        .set({ status })
        .where(
          inArray(
            comment.id,
            group.map((i) => i.id),
          ),
        );
    }
    return { ok: true as const, postIds: [...new Set(found.map((c) => c.postId))] };
  });
}

// comment_vote cae en cascada.
export async function deleteCommentAsAdmin(
  id: string,
): Promise<{ ok: true; postId: string } | { ok: false; reason: "not-found" }> {
  const [row] = await getDb()
    .delete(comment)
    .where(eq(comment.id, id))
    .returning({ postId: comment.postId });
  return row ? { ok: true, postId: row.postId } : { ok: false, reason: "not-found" };
}
