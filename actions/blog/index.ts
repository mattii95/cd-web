"use server";

import { z } from "zod";
import { cachedApprovedComments, cachedPublishedPosts } from "@/db/blog-cache";
import type { PostFilters, PostSummary, PublicComment } from "@/db/blog";

export type LoadMorePostsState =
  | { status: "success"; items: PostSummary[]; nextCursor: string | null }
  | { status: "error"; message: string };

export type LoadMoreCommentsState =
  | { status: "success"; items: PublicComment[]; nextCursor: string | null }
  | { status: "error"; message: string };

const cursorSchema = z.string().min(1).max(200);
const slugSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,60}$/)
  .optional();
const filtersSchema = z.object({ category: slugSchema, tag: slugSchema });

// Públicas, sin sesión: solo leen posts y comentarios ya publicados.
export async function loadMorePostsAction(
  cursor: string,
  filters: PostFilters,
): Promise<LoadMorePostsState> {
  const c = cursorSchema.safeParse(cursor);
  const f = filtersSchema.safeParse(filters ?? {});
  if (!c.success || !f.success) {
    return { status: "error", message: "No pudimos cargar más artículos." };
  }
  try {
    // Un cursor inválido (InvalidCursorError) cae acá igual que cualquier otro fallo.
    const { items, nextCursor } = await cachedPublishedPosts({
      ...f.data,
      cursor: c.data,
    });
    return { status: "success", items, nextCursor };
  } catch {
    return { status: "error", message: "No pudimos cargar más artículos." };
  }
}

export async function loadMoreCommentsAction(
  postId: string,
  cursor: string,
): Promise<LoadMoreCommentsState> {
  const id = z.uuid().safeParse(postId);
  const c = cursorSchema.safeParse(cursor);
  if (!id.success || !c.success) {
    return { status: "error", message: "No pudimos cargar más comentarios." };
  }
  try {
    const { items, nextCursor } = await cachedApprovedComments(id.data, {
      cursor: c.data,
    });
    return { status: "success", items, nextCursor };
  } catch {
    return { status: "error", message: "No pudimos cargar más comentarios." };
  }
}
