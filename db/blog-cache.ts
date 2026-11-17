import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { PageParams } from "@/lib/pagination";
import {
  getApprovedComments,
  getCategories,
  getPublishedPostBySlug,
  getPublishedPosts,
  getRatingSummary,
  getRelatedPosts,
  getTags,
  type PostListParams,
} from "./blog";

// Lecturas públicas del blog. Las páginas y las acciones llaman solo a estas
// funciones, siempre después de `await connection()` y dentro de <Suspense>.

export async function cachedCategories() {
  "use cache";
  cacheLife("hours");
  cacheTag("blog");
  return getCategories();
}

export async function cachedTags() {
  "use cache";
  cacheLife("hours");
  cacheTag("blog");
  return getTags();
}

export async function cachedPublishedPosts(params?: PostListParams) {
  "use cache";
  cacheLife("hours");
  cacheTag("blog");
  return getPublishedPosts(params);
}

export async function cachedPostBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("blog", `post:${slug}`);
  return getPublishedPostBySlug(slug);
}

export async function cachedRelatedPosts(postId: string, n?: number) {
  "use cache";
  cacheLife("hours");
  cacheTag("blog");
  return getRelatedPosts(postId, n);
}

export async function cachedRatingSummary(postId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("blog", `comments:${postId}`);
  return getRatingSummary(postId);
}

export async function cachedApprovedComments(
  postId: string,
  params?: PageParams,
) {
  "use cache";
  cacheLife("hours");
  cacheTag("blog", `comments:${postId}`);
  return getApprovedComments(postId, params);
}
