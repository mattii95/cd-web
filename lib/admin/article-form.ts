import { z } from "zod";
import { blogBodySchema, docHasText, type BlogDoc } from "@/db/blog-body";
import { isSlug, slugify } from "@/lib/slug";

export type ArticleIntent = "draft" | "publish" | "unpublish" | "save";

export const ARTICLE_LIMITS = {
  title: 120,
  excerpt: 300,
  cta: 300,
  tags: 5,
  tagName: 40,
} as const;

export type ArticleInput = {
  title: string;
  slug: string;
  excerpt: string;
  cta: string;
  categoryId: string; // uuid
  body: BlogDoc;
  tags: string[]; // nombres, únicos por slug, máx. 5
};
export type ArticleField = keyof ArticleInput;
export type ArticleFieldErrors = Partial<Record<ArticleField, string>>;

export type ParsedArticleForm =
  | {
      ok: true;
      id: string | null; // null en /new; si no es uuid, la action responde "ya no existe"
      intent: ArticleIntent;
      expectedUpdatedAt: Date | null; // null o inválida con id → la action lo trata como conflicto
      input: ArticleInput;
    }
  | { ok: false; fieldErrors: ArticleFieldErrors };

export const EMPTY_DOC: BlogDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const INTENTS: ArticleIntent[] = ["draft", "publish", "unpublish", "save"];

// Estado con el que queda el post: decide si se exigen resumen, CTA y cuerpo.
export function resultingStatus(
  intent: ArticleIntent,
  currentStatus: "borrador" | "publicado" | null,
): "borrador" | "publicado" {
  if (intent === "publish") return "publicado";
  if (intent === "save") return currentStatus ?? "borrador";
  return "borrador";
}

const str = (data: FormData, key: string) => {
  const v = data.get(key);
  return typeof v === "string" ? v : "";
};

export const normalizeTagName = (name: string) =>
  name.trim().replace(/\s+/g, " ");

// `status` sale de `intent` y de `currentStatus`; el body llega como JSON en `data.get("body")`.
export function parseArticleForm(
  data: FormData,
  currentStatus: "borrador" | "publicado" | null,
): ParsedArticleForm {
  const intent = str(data, "intent") as ArticleIntent;
  if (!INTENTS.includes(intent)) return { ok: false, fieldErrors: {} };

  const strict = resultingStatus(intent, currentStatus) === "publicado";
  const errors: ArticleFieldErrors = {};

  const title = str(data, "title").trim();
  if (!title) errors.title = "Escribí un título.";
  else if (title.length > ARTICLE_LIMITS.title)
    errors.title = `El título no puede pasar de ${ARTICLE_LIMITS.title} caracteres.`;

  const categoryId = str(data, "categoryId");
  if (!z.uuid().safeParse(categoryId).success)
    errors.categoryId = "Elegí una categoría.";

  let slug = str(data, "slug").trim();
  if (!slug && !strict) slug = slugify(title);
  if (!isSlug(slug))
    errors.slug = slug
      ? "Usá solo minúsculas, números y guiones (máx. 80)."
      : "Escribí la URL del artículo.";

  const excerpt = str(data, "excerpt").trim();
  if (excerpt.length > ARTICLE_LIMITS.excerpt)
    errors.excerpt = `El resumen no puede pasar de ${ARTICLE_LIMITS.excerpt} caracteres.`;
  else if (strict && !excerpt) errors.excerpt = "Escribí el resumen.";

  const cta = str(data, "cta").trim();
  if (cta.length > ARTICLE_LIMITS.cta)
    errors.cta = `El llamado a la acción no puede pasar de ${ARTICLE_LIMITS.cta} caracteres.`;
  else if (strict && !cta) errors.cta = "Escribí el llamado a la acción.";

  let body = EMPTY_DOC;
  const rawBody = str(data, "body");
  if (rawBody) {
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      json = null;
    }
    const parsed = blogBodySchema.safeParse(json);
    if (parsed.success) body = parsed.data;
    else errors.body = "El cuerpo tiene un formato que no se puede guardar.";
  }
  if (!errors.body && strict && !docHasText(body))
    errors.body = "Escribí el cuerpo del artículo.";

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of data.getAll("tags")) {
    const name = normalizeTagName(typeof raw === "string" ? raw : "");
    const key = slugify(name);
    if (!key) continue;
    if (name.length > ARTICLE_LIMITS.tagName) {
      errors.tags = `Cada etiqueta puede tener hasta ${ARTICLE_LIMITS.tagName} caracteres.`;
      break;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(name);
  }
  if (!errors.tags && tags.length > ARTICLE_LIMITS.tags)
    errors.tags = `Podés usar hasta ${ARTICLE_LIMITS.tags} etiquetas.`;

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };

  const updatedAt = new Date(str(data, "updatedAt"));
  return {
    ok: true,
    id: str(data, "id") || null,
    intent,
    expectedUpdatedAt: Number.isNaN(updatedAt.getTime()) ? null : updatedAt,
    input: { title, slug, excerpt, cta, categoryId, body, tags },
  };
}
