import "server-only";
import { and, asc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { TAGS_PER_PAGE, type AdminTagQuery } from "@/lib/admin/tag-params";
import type { TagInput } from "@/lib/admin/taxonomy-form";
import { slugify } from "@/lib/slug";
import { isUniqueViolation } from "./admin-posts";
import { getDb } from "./client";
import { post, postTag, tag } from "./schema";

// Consultas del panel: sin caché. Quien escribe invalida `blog` con updateTag.

export type AdminTagRow = {
  id: string;
  slug: string;
  name: string;
  published: number;
  total: number;
};
export type AdminTagList = {
  items: AdminTagRow[];
  total: number; // con la búsqueda
  page: number; // acotada a [1, pageCount]
  pageCount: number; // ≥ 1
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");
const searchWhere = (q: string | null) => {
  if (!q) return undefined;
  const pattern = `%${escapeLike(q)}%`;
  return or(ilike(tag.name, pattern), ilike(tag.slug, pattern));
};
const articleCounts = {
  published: sql<number>`count(${post.id}) filter (where ${post.status} = 'publicado')::int`,
  total: sql<number>`count(${post.id})::int`,
};

export async function listAdminTags(query: AdminTagQuery): Promise<AdminTagList> {
  const db = getDb();
  const where = searchWhere(query.q);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(tag)
    .where(where);
  const pageCount = Math.max(1, Math.ceil(total / TAGS_PER_PAGE));
  const page = Math.min(query.page, pageCount);

  const items = await db
    .select({ id: tag.id, slug: tag.slug, name: tag.name, ...articleCounts })
    .from(tag)
    .leftJoin(postTag, eq(postTag.tagId, tag.id))
    .leftJoin(post, eq(post.id, postTag.postId))
    .where(where)
    .groupBy(tag.id)
    .orderBy(asc(sql`lower(${tag.name})`), asc(tag.id)) // id desempata: sin él, las páginas se mezclan
    .limit(TAGS_PER_PAGE)
    .offset((page - 1) * TAGS_PER_PAGE);

  return { items, total, page, pageCount };
}

export type TagResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; reason: "slug-taken" | "name-taken" | "not-found" };

type Db = Pick<ReturnType<typeof getDb>, "select">;

// Con nombre y slug independientes, dos etiquetas "SEO" romperían el autocompletado del editor.
// slugify no se puede evaluar en SQL: la tabla es chica, se compara en código.
async function nameTaken(db: Db, name: string, exceptId?: string): Promise<boolean> {
  const key = slugify(name);
  const rows = await db
    .select({ name: tag.name })
    .from(tag)
    .where(exceptId ? ne(tag.id, exceptId) : undefined);
  return rows.some((r) => slugify(r.name) === key);
}

export async function createTag(input: TagInput): Promise<TagResult> {
  try {
    return await getDb().transaction(async (tx) => {
      if (await nameTaken(tx, input.name)) return { ok: false as const, reason: "name-taken" as const };
      const [row] = await tx.insert(tag).values(input).returning({ id: tag.id, slug: tag.slug });
      return { ok: true as const, id: row.id, slug: row.slug };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "slug-taken" };
    throw e;
  }
}

// Con algún artículo publicado el slug no cambia: se ignora input.slug.
export async function updateTagRow(id: string, input: TagInput): Promise<TagResult> {
  try {
    return await getDb().transaction(async (tx) => {
      const [current] = await tx
        .select({ slug: tag.slug })
        .from(tag)
        .where(eq(tag.id, id))
        .for("update");
      if (!current) return { ok: false as const, reason: "not-found" as const };
      if (await nameTaken(tx, input.name, id)) return { ok: false as const, reason: "name-taken" as const };
      const [{ published }] = await tx
        .select({ published: sql<number>`count(*)::int` })
        .from(postTag)
        .innerJoin(post, eq(post.id, postTag.postId))
        .where(and(eq(postTag.tagId, id), eq(post.status, "publicado")));
      const slug = published > 0 ? current.slug : input.slug;
      await tx.update(tag).set({ name: input.name, slug }).where(eq(tag.id, id));
      return { ok: true as const, id, slug };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "slug-taken" };
    throw e;
  }
}

// Los post_tag caen por cascade; los artículos siguen existiendo.
export async function deleteTag(id: string): Promise<{ ok: true } | { ok: false; reason: "not-found" }> {
  const rows = await getDb().delete(tag).where(eq(tag.id, id)).returning({ id: tag.id });
  return rows.length ? { ok: true } : { ok: false, reason: "not-found" };
}

// Los artículos del origen pasan al destino y el origen se borra. Un artículo que ya tenía las dos
// queda con el destino una vez (onConflictDoNothing), así ninguno supera las 5 etiquetas.
export async function mergeTags(
  sourceId: string,
  targetId: string,
): Promise<{ ok: true; moved: number; target: string } | { ok: false; reason: "not-found" | "same" }> {
  if (sourceId === targetId) return { ok: false, reason: "same" };
  return getDb().transaction(async (tx) => {
    const found = await tx
      .select({ id: tag.id, name: tag.name })
      .from(tag)
      .where(inArray(tag.id, [sourceId, targetId]))
      .for("update");
    const target = found.find((t) => t.id === targetId);
    if (!target || !found.some((t) => t.id === sourceId))
      return { ok: false as const, reason: "not-found" as const };

    const [{ moved }] = await tx
      .select({ moved: sql<number>`count(*)::int` })
      .from(postTag)
      .where(eq(postTag.tagId, sourceId));
    await tx.execute(
      sql`insert into post_tag (post_id, tag_id) select post_id, ${targetId} from post_tag where tag_id = ${sourceId} on conflict do nothing`,
    );
    await tx.delete(tag).where(eq(tag.id, sourceId));
    return { ok: true as const, moved, target: target.name };
  });
}

// Para el combobox de "Fusionar con…": máx. 10, sin la etiqueta de origen.
export async function searchTagOptions(
  query: string,
  excludeId: string,
): Promise<{ id: string; name: string; total: number }[]> {
  const q = query.trim();
  return getDb()
    .select({ id: tag.id, name: tag.name, total: articleCounts.total })
    .from(tag)
    .leftJoin(postTag, eq(postTag.tagId, tag.id))
    .leftJoin(post, eq(post.id, postTag.postId))
    .where(and(ne(tag.id, excludeId), searchWhere(q || null)))
    .groupBy(tag.id)
    .orderBy(asc(sql`lower(${tag.name})`), asc(tag.id))
    .limit(10);
}
