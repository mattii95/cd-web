// Tipos y formateadores del blog. Los datos mock viven en db/seed/blog-data.ts.
// TODO(SPEC 13, paso 9): quitar el reexport temporal de abajo.
import {
  blogAuthor,
  blogCategories,
  blogPosts,
  blogTags,
  type BlogCategory,
  type BlogPost,
  type BlogReviews,
} from "@/db/seed/blog-data";

export { blogAuthor, blogCategories, blogPosts, blogTags };
export type {
  BlogAuthor,
  BlogCategory,
  BlogComment,
  BlogPost,
  BlogReviews,
} from "@/db/seed/blog-data";

export type BlogCategoryTag = "desarrollo-web" | "sistemas" | "saas" | "ia";

export type BlogTagSlug =
  | "atencion-al-cliente"
  | "automatizacion"
  | "chatbots"
  | "gestion"
  | "landing-page"
  | "mvp"
  | "pymes"
  | "rendimiento"
  | "seo"
  | "validacion"
  | "ventas";

export type BlogTag = { slug: BlogTagSlug; name: string };

export type BlogImage = {
  src: string; // "/media/<id>" o "/blog/senales-portada.webp" en el mock
  width: number;
  height: number;
  alt: string;
};

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; id: string; text: string } // id: "s1", "s2"… → ancla y entrada del índice
  | { type: "tip"; text: string } // recuadro "Consejo"
  | { type: "summary"; text: string } // recuadro "En resumen"
  | { type: "image"; image: BlogImage; caption?: string }; // ya resuelto

export type BlogRating = 1 | 2 | 3 | 4 | 5;

export const getPost = (slug: string) => blogPosts.find((p) => p.slug === slug);

export const getCategory = (tag: BlogCategoryTag) =>
  blogCategories.find((c) => c.tag === tag)!;

export const getTag = (slug: BlogTagSlug) =>
  blogTags.find((t) => t.slug === slug);

// Etiquetas usadas por los posts, por cantidad descendente y slug ascendente.
export function getUsedTags(posts: Pick<BlogPost, "tags">[]) {
  const counts = new Map<BlogTagSlug, number>();
  for (const { tags } of posts)
    for (const slug of tags) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  return blogTags
    .filter((t) => counts.has(t.slug))
    .map((t) => ({ ...t, count: counts.get(t.slug)! }))
    .sort((a, b) => b.count - a.count || (a.slug < b.slug ? -1 : 1));
}

export function getRatingSummary({ distribution }: BlogReviews) {
  const stars = [1, 2, 3, 4, 5] as const;
  const total = stars.reduce((n, r) => n + distribution[r], 0);
  const sum = stars.reduce((n, r) => n + r * distribution[r], 0);
  return { average: total ? sum / total : 0, total };
}

// "4,6": coma decimal fija, sin depender del locale del entorno.
export const formatAverage = (n: number) => n.toFixed(1).replace(".", ",");

export const getRecentPosts = (n: number) => blogPosts.slice(0, n);

// Misma categoría primero, después los más recientes.
export function getRelatedPosts(post: BlogPost, n: number) {
  const others = blogPosts.filter((p) => p.slug !== post.slug);
  return [
    ...others.filter((p) => p.category === post.category),
    ...others.filter((p) => p.category !== post.category),
  ].slice(0, n);
}

// Fecha fija en UTC: no depende de la hora actual, así el prerender no se rompe.
export const formatPostDate = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(iso))
    .replace(/\./g, "")
    .replace(/ de /g, " ");
