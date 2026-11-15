import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { BlogBlock, BlogCategoryTag, BlogRating } from "@/lib/blog-posts";
import type { ServiceSlug } from "@/lib/services";
import { blogBodySchema } from "./blog-body";
import { getDb } from "./client";
import {
  authorProfile,
  category,
  comment,
  commentVote,
  post,
  postRating,
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
};
export type PostDetail = PostSummary & { body: BlogBlock[]; cta: string };
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
      category,
      authorName: user.name,
      authorImage: user.image,
      jobTitle: authorProfile.jobTitle,
      bio: authorProfile.bio,
    })
    .from(post)
    .innerJoin(category, eq(category.id, post.categoryId))
    .innerJoin(user, eq(user.id, post.authorId))
    .leftJoin(authorProfile, eq(authorProfile.userId, post.authorId));
}

type PublishedRow = Awaited<ReturnType<typeof selectPublished>>[number];

const toSummary = (r: PublishedRow): PostSummary => ({
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
});

export async function getPublishedPosts(): Promise<PostSummary[]> {
  const rows = await selectPublished()
    .where(eq(post.status, "publicado"))
    .orderBy(desc(post.publishedAt));
  return rows.map(toSummary);
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
  return { ...toSummary(row), body: body.data, cta: row.post.cta };
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
): Promise<PublicComment[]> {
  const rows = await getDb()
    .select({
      id: comment.id,
      authorName: user.name,
      authorImage: user.image,
      rating: postRating.rating,
      text: comment.text,
      usefulCount: sql<number>`(select count(*)::int from ${commentVote} where ${commentVote.commentId} = ${comment.id})`,
      createdAt: comment.createdAt,
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
    .where(and(eq(comment.postId, postId), eq(comment.status, "aprobado")))
    .orderBy(desc(comment.createdAt));

  return rows.map((r) => ({
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
  }));
}
