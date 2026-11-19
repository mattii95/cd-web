import { like } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  authorProfile,
  category,
  comment,
  commentVote,
  media,
  post,
  postRating,
  tag,
  user,
} from "@/db/schema";

// Orden de hijos a padres: post, category y media tienen FK restrict.
export async function resetBlog() {
  const db = getDb();
  await db.delete(commentVote);
  await db.delete(comment);
  await db.delete(postRating);
  await db.delete(post);
  await db.delete(tag); // post_tag cae por cascade
  await db.delete(media);
  await db.delete(authorProfile);
  await db.delete(category);
  await db.delete(user).where(like(user.email, "%@demo.invalid"));
}

export const nuevoUsuario = (id: string) => ({
  id,
  name: id,
  email: `${id}@demo.invalid`, // resetBlog borra este dominio
});

export const nuevaCategoria = (slug = "sistemas") => ({
  slug,
  label: slug,
  filterLabel: slug,
  serviceSlug: "sistemas-a-medida",
  icon: "layers" as const,
  position: 1,
});

export const nuevoPost = (
  categoryId: string,
  authorId: string,
  slug = "post-1",
) => ({
  slug,
  title: slug,
  excerpt: "extracto",
  body: {
    type: "doc" as const,
    content: [
      {
        type: "paragraph" as const,
        content: [{ type: "text" as const, text: "texto" }],
      },
    ],
  },
  cta: "cta",
  readingMinutes: 5,
  categoryId,
  authorId,
  status: "publicado" as const,
  publishedAt: new Date("2026-11-10"),
});
