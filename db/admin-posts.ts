import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import type { ArticleInput } from "@/lib/admin/article-form";
import type { AdminPostQuery } from "@/lib/admin/article-params";
import { slugify } from "@/lib/slug";
import { type BlogDoc, docReadingMinutes } from "./blog-body";
import { getDb } from "./client";
import { category, media, post, postTag, tag } from "./schema";

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

// ---- Editor de artículos ----

export type EditablePost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cta: string;
  categoryId: string;
  body: BlogDoc;
  tags: { slug: string; name: string }[];
  status: "borrador" | "publicado";
  publishedAt: Date | null;
  updatedAt: Date;
  cover: { src: string; alt: string } | null;
  images: Record<string, { src: string; alt: string }>; // mediaId → miniatura
};

export async function getPostForEdit(id: string): Promise<EditablePost | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const db = getDb();
  const [row] = await db.select().from(post).where(eq(post.id, id));
  if (!row) return null;

  const tags = await db
    .select({ slug: tag.slug, name: tag.name })
    .from(postTag)
    .innerJoin(tag, eq(tag.id, postTag.tagId))
    .where(eq(postTag.postId, id))
    .orderBy(asc(tag.name), asc(tag.slug));

  const ids = new Set<string>();
  for (const n of row.body.content) if (n.type === "image") ids.add(n.attrs.mediaId);
  if (row.coverMediaId) ids.add(row.coverMediaId);
  const found = ids.size
    ? await db
        .select({ id: media.id, alt: media.alt })
        .from(media)
        .where(inArray(media.id, [...ids]))
    : [];
  const thumb = new Map(found.map((m) => [m.id, { src: `/media/${m.id}`, alt: m.alt }]));

  const images: EditablePost["images"] = {};
  for (const n of row.body.content) {
    const t = n.type === "image" ? thumb.get(n.attrs.mediaId) : undefined;
    if (n.type === "image" && t) images[n.attrs.mediaId] = t;
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    cta: row.cta,
    categoryId: row.categoryId,
    body: row.body,
    tags,
    status: row.status,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    cover: row.coverMediaId ? (thumb.get(row.coverMediaId) ?? null) : null,
    images,
  };
}

export async function listAllTags(): Promise<{ slug: string; name: string }[]> {
  return getDb()
    .select({ slug: tag.slug, name: tag.name })
    .from(tag)
    .orderBy(asc(tag.name), asc(tag.slug));
}

export type SavePostResult =
  | { ok: true; id: string; slug: string; previousSlug: string | null; updatedAt: Date }
  | { ok: false; reason: "slug-taken" | "stale" | "not-found" };

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

// Las etiquetas nuevas se crean con onConflictDoNothing por slug; post_tag se reemplaza entero.
async function replaceTags(tx: Tx, postId: string, names: string[]) {
  await tx.delete(postTag).where(eq(postTag.postId, postId));
  const bySlug = new Map(names.map((name) => [slugify(name), name]));
  if (!bySlug.size) return;
  await tx
    .insert(tag)
    .values([...bySlug].map(([slug, name]) => ({ slug, name })))
    .onConflictDoNothing({ target: tag.slug });
  const rows = await tx
    .select({ id: tag.id })
    .from(tag)
    .where(inArray(tag.slug, [...bySlug.keys()]));
  await tx.insert(postTag).values(rows.map((r) => ({ postId, tagId: r.id })));
}

// 23505 = unique_violation (drizzle envuelve el error de pg en `cause`).
function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

export async function createPost(
  input: ArticleInput,
  status: "borrador" | "publicado",
  authorId: string,
): Promise<SavePostResult> {
  try {
    return await getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(post)
        .values({
          slug: input.slug,
          title: input.title,
          excerpt: input.excerpt,
          cta: input.cta,
          body: input.body,
          readingMinutes: docReadingMinutes(input.body),
          categoryId: input.categoryId,
          authorId,
          status,
          publishedAt: status === "publicado" ? new Date() : null,
        })
        .returning({ id: post.id, slug: post.slug, updatedAt: post.updatedAt });
      await replaceTags(tx, row.id, input.tags);
      return { ok: true as const, id: row.id, slug: row.slug, previousSlug: null, updatedAt: row.updatedAt };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "slug-taken" };
    throw e;
  }
}

// El slug de un post con published_at no cambia. No toca cover_media_id ni author_id.
export async function updatePost(
  id: string,
  input: ArticleInput,
  status: "borrador" | "publicado",
  expectedUpdatedAt: Date,
): Promise<SavePostResult> {
  try {
    return await getDb().transaction(async (tx) => {
      const [current] = await tx
        .select({ slug: post.slug, publishedAt: post.publishedAt, updatedAt: post.updatedAt })
        .from(post)
        .where(eq(post.id, id))
        .for("update");
      if (!current) return { ok: false as const, reason: "not-found" as const };
      if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime())
        return { ok: false as const, reason: "stale" as const };

      const slug = current.publishedAt ? current.slug : input.slug;
      const updatedAt = new Date();
      await tx
        .update(post)
        .set({
          slug,
          title: input.title,
          excerpt: input.excerpt,
          cta: input.cta,
          body: input.body,
          readingMinutes: docReadingMinutes(input.body),
          categoryId: input.categoryId,
          status,
          publishedAt: current.publishedAt ?? (status === "publicado" ? updatedAt : null),
          updatedAt,
        })
        .where(eq(post.id, id));
      await replaceTags(tx, id, input.tags);
      return {
        ok: true as const,
        id,
        slug,
        previousSlug: slug !== current.slug ? current.slug : null,
        updatedAt,
      };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "slug-taken" };
    throw e;
  }
}

// Para el select del editor: getCategories (público) no expone el id.
export async function listEditorCategories(): Promise<{ id: string; label: string }[]> {
  return getDb()
    .select({ id: category.id, label: category.label })
    .from(category)
    .orderBy(asc(category.position));
}
