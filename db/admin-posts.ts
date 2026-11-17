import "server-only";
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { AdminPostQuery } from "@/lib/admin/article-params";
import { getDb } from "./client";
import { category, post } from "./schema";

// Consultas del panel: sin caché, el admin ve siempre la base actual.
export type AdminPostRow = {
  id: string;
  slug: string;
  title: string;
  category: { slug: string; label: string };
  status: "borrador" | "publicado";
  readingMinutes: number;
  updatedAt: Date;
  publishedAt: Date | null;
};
export type AdminPostList = {
  items: AdminPostRow[];
  total: number; // con filtros
  page: number; // acotada a [1, pageCount]
  pageCount: number; // ≥ 1
  counts: { all: number; publicado: number; borrador: number }; // sin filtros
};

const STATUS = { published: "publicado", draft: "borrador" } as const;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

function buildWhere(query: AdminPostQuery): SQL | undefined {
  const conds: (SQL | undefined)[] = [];
  if (query.status) conds.push(eq(post.status, STATUS[query.status]));
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    conds.push(or(ilike(post.title, pattern), ilike(post.slug, pattern)));
  }
  if (query.category) conds.push(eq(category.slug, query.category));
  if (query.updated === "7d") conds.push(sql`${post.updatedAt} >= now() - interval '7 days'`);
  if (query.updated === "30d") conds.push(sql`${post.updatedAt} >= now() - interval '30 days'`);
  if (query.updated === "year") conds.push(sql`${post.updatedAt} >= date_trunc('year', now())`);
  return and(...conds);
}

export async function listAdminPosts(query: AdminPostQuery): Promise<AdminPostList> {
  const db = getDb();
  const where = buildWhere(query);

  const [{ total }] = await db
    .select({ total: count() })
    .from(post)
    .innerJoin(category, eq(post.categoryId, category.id))
    .where(where);
  const [counts] = await db
    .select({
      all: count(),
      publicado: sql<number>`count(*) filter (where ${post.status} = 'publicado')`.mapWith(Number),
      borrador: sql<number>`count(*) filter (where ${post.status} = 'borrador')`.mapWith(Number),
    })
    .from(post);

  const pageCount = Math.max(1, Math.ceil(total / query.perPage));
  const page = Math.min(query.page, pageCount);

  const dir = query.dir === "asc" ? asc : desc;
  const sortCol = {
    title: sql`lower(${post.title})`,
    readingTime: post.readingMinutes,
    updated: post.updatedAt,
  }[query.sort];

  const rows = await db
    .select({
      id: post.id,
      slug: post.slug,
      title: post.title,
      categorySlug: category.slug,
      categoryLabel: category.label,
      status: post.status,
      readingMinutes: post.readingMinutes,
      updatedAt: post.updatedAt,
      publishedAt: post.publishedAt,
    })
    .from(post)
    .innerJoin(category, eq(post.categoryId, category.id))
    .where(where)
    .orderBy(dir(sortCol), dir(post.id)) // id desempata: sin él, las páginas se mezclan
    .limit(query.perPage)
    .offset((page - 1) * query.perPage);

  return {
    items: rows.map(({ categorySlug, categoryLabel, ...r }) => ({
      ...r,
      category: { slug: categorySlug, label: categoryLabel },
    })),
    total,
    page,
    pageCount,
    counts,
  };
}

// null si el id no existe; `changed` false si ya tenía ese estado.
export async function setPostStatus(
  id: string,
  status: "borrador" | "publicado",
): Promise<{ slug: string; changed: boolean } | null> {
  const db = getDb();
  const [current] = await db
    .select({ slug: post.slug, status: post.status })
    .from(post)
    .where(eq(post.id, id));
  if (!current) return null;
  if (current.status === status) return { slug: current.slug, changed: false };

  // published_at solo se fija la primera vez: el artículo vuelve a su lugar en el blog.
  await db
    .update(post)
    .set({
      status,
      ...(status === "publicado" && { publishedAt: sql`coalesce(${post.publishedAt}, now())` }),
    })
    .where(eq(post.id, id));
  return { slug: current.slug, changed: true };
}

// post_tag, post_rating, comment y comment_vote se van por cascade.
export async function deletePost(id: string): Promise<{ slug: string } | null> {
  const [row] = await getDb().delete(post).where(eq(post.id, id)).returning({ slug: post.slug });
  return row ?? null;
}
