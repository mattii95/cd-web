import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type {
  BlogCategoryTag,
  BlogImage,
  BlogRating,
  BlogTag,
  BlogTagSlug,
} from "@/lib/blog-posts";
import {
  decodeCursor,
  encodeCursor,
  type Page,
  type PageParams,
  resolveLimit,
} from "@/lib/pagination";
import type { ServiceSlug } from "@/lib/services";
import {
  type BlogDoc,
  blocksToDoc,
  blogBodySchema,
  type ResolvedBlogDoc,
} from "./blog-body";
import { getDb } from "./client";
import {
  authorProfile,
  category,
  comment,
  commentVote,
  media,
  post,
  postRating,
  postTag,
  tag,
  user,
} from "./schema";

export type BlogCategoryRow = {
  slug: BlogCategoryTag;
  label: string;
  filterLabel: string;
  serviceSlug: ServiceSlug;
};
export type PostAuthor = {
  name: string;
  image: string | null;
  jobTitle: string | null;
  bio: string | null;
};
export type PostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  publishedAt: Date;
  category: BlogCategoryRow;
  author: PostAuthor;
  cover: BlogImage | null;
  tags: BlogTag[]; // slug ascendente
};
export type TagRow = BlogTag & { count: number }; // count de posts publicados
export type PostDetail = PostSummary & { body: ResolvedBlogDoc; cta: string };
export type RatingSummary = {
  average: number; // 0 si no hay valoraciones; sin redondear
  total: number;
  distribution: Record<BlogRating, number>;
};
export type PublicComment = {
  id: string;
  authorName: string;
  authorImage: string | null;
  rating: BlogRating | null; // valoración del mismo usuario en el mismo post
  text: string;
  usefulCount: number;
  createdAt: Date;
  reply: { text: string; repliedAt: Date } | null;
};

const toCategory = (c: typeof category.$inferSelect): BlogCategoryRow => ({
  slug: c.slug as BlogCategoryTag,
  label: c.label,
  filterLabel: c.filterLabel,
  serviceSlug: c.serviceSlug as ServiceSlug,
});

export async function getCategories(): Promise<BlogCategoryRow[]> {
  const rows = await getDb()
    .select()
    .from(category)
    .orderBy(asc(category.position));
  return rows.map(toCategory);
}

// Solo columnas públicas del autor: nunca el email.
function selectPublished() {
  return getDb()
    .select({
      post,
      publishedAtText: sql<string>`${post.publishedAt}::text`, // cursor: conserva los microsegundos
      category,
      cover: media,
      authorName: user.name,
      authorImage: user.image,
      jobTitle: authorProfile.jobTitle,
      bio: authorProfile.bio,
    })
    .from(post)
    .innerJoin(category, eq(category.id, post.categoryId))
    .leftJoin(media, eq(media.id, post.coverMediaId))
    .innerJoin(user, eq(user.id, post.authorId))
    .leftJoin(authorProfile, eq(authorProfile.userId, post.authorId));
}

type PublishedRow = Awaited<ReturnType<typeof selectPublished>>[number];

const mediaImage = (m: typeof media.$inferSelect): BlogImage => ({
  src: `/media/${m.id}`,
  width: m.width,
  height: m.height,
  alt: m.alt,
});

const toSummary = (r: PublishedRow, tags: BlogTag[]): PostSummary => ({
  id: r.post.id,
  slug: r.post.slug,
  title: r.post.title,
  excerpt: r.post.excerpt,
  readingMinutes: r.post.readingMinutes,
  publishedAt: r.post.publishedAt!, // el check de la tabla lo garantiza si está publicado
  category: toCategory(r.category),
  author: {
    name: r.authorName,
    image: r.authorImage,
    jobTitle: r.jobTitle,
    bio: r.bio,
  },
  cover: r.cover ? mediaImage(r.cover) : null,
  tags,
});

const bySlug = (a: { slug: string }, b: { slug: string }) =>
  a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0; // en código: la collation de la base cambia entre entornos

// Una sola consulta para las etiquetas de todos los posts.
async function getTagsByPost(postIds: string[]) {
  const byPost = new Map<string, BlogTag[]>();
  if (postIds.length === 0) return byPost;
  const rows = await getDb()
    .select({ postId: postTag.postId, slug: tag.slug, name: tag.name })
    .from(postTag)
    .innerJoin(tag, eq(tag.id, postTag.tagId))
    .where(inArray(postTag.postId, postIds));
  for (const r of rows) {
    const list = byPost.get(r.postId) ?? [];
    list.push({ slug: r.slug as BlogTagSlug, name: r.name });
    byPost.set(r.postId, list);
  }
  for (const list of byPost.values()) list.sort(bySlug);
  return byPost;
}

// Cambia el mediaId de los nodos image de la raíz por la imagen de la biblioteca.
async function resolveBody(
  slug: string,
  body: BlogDoc,
): Promise<ResolvedBlogDoc> {
  const ids = [
    ...new Set(
      body.content.flatMap((n) =>
        n.type === "image" ? [n.attrs.mediaId] : [],
      ),
    ),
  ];
  const rows = ids.length
    ? await getDb().select().from(media).where(inArray(media.id, ids))
    : [];
  const byId = new Map(rows.map((m) => [m.id, m]));
  return {
    type: "doc",
    content: body.content.map((n): ResolvedBlogDoc["content"][number] => {
      if (n.type !== "image") return n;
      const m = byId.get(n.attrs.mediaId);
      if (!m) {
        throw new Error(
          `El post "${slug}" usa la imagen ${n.attrs.mediaId}, que no existe en media`,
        );
      }
      return {
        type: "image",
        attrs: {
          image: { ...mediaImage(m), alt: n.attrs.alt ?? m.alt },
          caption: n.attrs.caption,
        },
      };
    }),
  };
}

export type PostFilters = { category?: string; tag?: string }; // slugs
export type PostListParams = PageParams & PostFilters;

export async function getPublishedPosts(
  params: PostListParams = {},
): Promise<Page<PostSummary>> {
  const limit = resolveLimit(params.limit, 12);
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  const rows = await selectPublished()
    .where(
      and(
        eq(post.status, "publicado"),
        params.category ? eq(category.slug, params.category) : undefined,
        params.tag
          ? sql`exists (select 1 from ${postTag} join ${tag} on ${tag.id} = ${postTag.tagId} where ${postTag.postId} = ${post.id} and ${tag.slug} = ${params.tag})`
          : undefined,
        cursor
          ? sql`(${post.publishedAt}, ${post.id}) < (${cursor.t}::timestamp, ${cursor.id})`
          : undefined,
      ),
    )
    .orderBy(desc(post.publishedAt), desc(post.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit
      ? encodeCursor({ t: last.publishedAtText, id: last.post.id })
      : null;

  const tagsByPost = await getTagsByPost(page.map((r) => r.post.id));
  return {
    items: page.map((r) => toSummary(r, tagsByPost.get(r.post.id) ?? [])),
    nextCursor,
  };
}

// Misma categoría primero, después los más recientes de otras. Sin el propio post.
export async function getRelatedPosts(
  postId: string,
  n = 3,
): Promise<PostSummary[]> {
  const rows = await selectPublished()
    .where(and(eq(post.status, "publicado"), ne(post.id, postId)))
    .orderBy(
      sql`(${post.categoryId} = (select ${post.categoryId} from ${post} where ${post.id} = ${postId})) desc`,
      desc(post.publishedAt),
      desc(post.id),
    )
    .limit(n);
  const tagsByPost = await getTagsByPost(rows.map((r) => r.post.id));
  return rows.map((r) => toSummary(r, tagsByPost.get(r.post.id) ?? []));
}

// Etiquetas con al menos un post publicado, por cantidad descendente y slug ascendente.
export async function getTags(): Promise<TagRow[]> {
  const rows = await getDb()
    .select({
      slug: tag.slug,
      name: tag.name,
      count: sql<number>`count(*)::int`,
    })
    .from(tag)
    .innerJoin(postTag, eq(postTag.tagId, tag.id))
    .innerJoin(post, eq(post.id, postTag.postId))
    .where(eq(post.status, "publicado"))
    .groupBy(tag.id);
  return rows
    .map((r) => ({ ...r, slug: r.slug as BlogTagSlug }))
    .sort((a, b) => b.count - a.count || bySlug(a, b));
}

export async function getPublishedPostBySlug(
  slug: string,
): Promise<PostDetail | null> {
  const [row] = await selectPublished().where(
    and(eq(post.slug, slug), eq(post.status, "publicado")),
  );
  if (!row) return null;
  const body = blogBodySchema.safeParse(row.post.body);
  if (!body.success) {
    throw new Error(
      `El body del post "${slug}" no cumple blogBodySchema: ${body.error.message}`,
    );
  }
  return {
    ...toSummary(
      row,
      (await getTagsByPost([row.post.id])).get(row.post.id) ?? [],
    ),
    // Temporal (paso 2): el body aún está en formato viejo hasta la migración.
    body: await resolveBody(slug, blocksToDoc(body.data)),
    cta: row.post.cta,
  };
}

export async function getRatingSummary(postId: string): Promise<RatingSummary> {
  const rows = await getDb()
    .select({ rating: postRating.rating, count: sql<number>`count(*)::int` })
    .from(postRating)
    .where(eq(postRating.postId, postId))
    .groupBy(postRating.rating);

  const distribution: Record<BlogRating, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  let total = 0;
  let sum = 0;
  for (const { rating, count } of rows) {
    distribution[rating as BlogRating] = count;
    total += count;
    sum += rating * count;
  }
  return { average: total ? sum / total : 0, total, distribution };
}

export async function getApprovedComments(
  postId: string,
  params: PageParams = {},
): Promise<Page<PublicComment>> {
  const limit = resolveLimit(params.limit, 20);
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  const rows = await getDb()
    .select({
      id: comment.id,
      authorName: user.name,
      authorImage: user.image,
      rating: postRating.rating,
      text: comment.text,
      usefulCount: sql<number>`(select count(*)::int from ${commentVote} where ${commentVote.commentId} = ${comment.id})`,
      createdAt: comment.createdAt,
      createdAtText: sql<string>`${comment.createdAt}::text`, // cursor: conserva los microsegundos
      replyText: comment.replyText,
      repliedAt: comment.repliedAt,
    })
    .from(comment)
    .innerJoin(user, eq(user.id, comment.userId))
    .leftJoin(
      postRating,
      and(
        eq(postRating.postId, comment.postId),
        eq(postRating.userId, comment.userId),
      ),
    )
    .where(
      and(
        eq(comment.postId, postId),
        eq(comment.status, "aprobado"),
        cursor
          ? sql`(${comment.createdAt}, ${comment.id}) < (${cursor.t}::timestamp, ${cursor.id})`
          : undefined,
      ),
    )
    .orderBy(desc(comment.createdAt), desc(comment.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit
      ? encodeCursor({ t: last.createdAtText, id: last.id })
      : null;

  return {
    items: page.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      authorImage: r.authorImage,
      rating: r.rating as BlogRating | null,
      text: r.text,
      usefulCount: r.usefulCount,
      createdAt: r.createdAt,
      reply:
        r.replyText && r.repliedAt
          ? { text: r.replyText, repliedAt: r.repliedAt }
          : null,
    })),
    nextCursor,
  };
}
