import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import type { CategoryInput } from "@/lib/admin/taxonomy-form";
import type { ServiceSlug } from "@/lib/services";
import { getDb } from "./client";
import { isUniqueViolation } from "./admin-posts";
import { category, post } from "./schema";

// Consultas del panel: sin caché. Quien escribe invalida `blog` con updateTag.

export type AdminCategoryRow = CategoryInput & {
  id: string;
  position: number;
  published: number;
  total: number;
};

export async function listAdminCategories(): Promise<AdminCategoryRow[]> {
  const rows = await getDb()
    .select({
      id: category.id,
      label: category.label,
      filterLabel: category.filterLabel,
      slug: category.slug,
      serviceSlug: category.serviceSlug,
      icon: category.icon,
      position: category.position,
      published: sql<number>`count(${post.id}) filter (where ${post.status} = 'publicado')::int`,
      total: sql<number>`count(${post.id})::int`,
    })
    .from(category)
    .leftJoin(post, eq(post.categoryId, category.id))
    .groupBy(category.id)
    .orderBy(asc(category.position), asc(category.id));
  return rows.map((r) => ({ ...r, serviceSlug: r.serviceSlug as ServiceSlug }));
}

export type CategoryResult =
  | { ok: true; id: string; slug: string; previousSlug: string | null }
  | { ok: false; reason: "slug-taken" | "not-found" };

// Queda última: position = la mayor + 1.
export async function createCategory(input: CategoryInput): Promise<CategoryResult> {
  try {
    return await getDb().transaction(async (tx) => {
      const [{ next }] = await tx
        .select({ next: sql<number>`coalesce(max(${category.position}), -1) + 1` })
        .from(category);
      const [row] = await tx
        .insert(category)
        .values({ ...input, position: next })
        .returning({ id: category.id, slug: category.slug });
      return { ok: true as const, id: row.id, slug: row.slug, previousSlug: null };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "slug-taken" };
    throw e;
  }
}

// Con algún artículo publicado el slug no cambia: se ignora input.slug.
export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<CategoryResult> {
  try {
    return await getDb().transaction(async (tx) => {
      const [current] = await tx
        .select({ slug: category.slug })
        .from(category)
        .where(eq(category.id, id))
        .for("update");
      if (!current) return { ok: false as const, reason: "not-found" as const };
      const [{ published }] = await tx
        .select({ published: sql<number>`count(*)::int` })
        .from(post)
        .where(sql`${post.categoryId} = ${id} and ${post.status} = 'publicado'`);
      const slug = published > 0 ? current.slug : input.slug;
      await tx
        .update(category)
        .set({ ...input, slug })
        .where(eq(category.id, id));
      return {
        ok: true as const,
        id,
        slug,
        previousSlug: slug !== current.slug ? current.slug : null,
      };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "slug-taken" };
    throw e;
  }
}

// Intercambia con la vecina. Renumera por posición en la lista (1, 2, 3…): si dos pestañas
// dejaron posiciones repetidas, el siguiente movimiento las corrige.
export async function moveCategory(
  id: string,
  direction: "up" | "down",
): Promise<{ ok: true; position: number } | { ok: false; reason: "not-found" | "edge" }> {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select({ id: category.id, position: category.position })
      .from(category)
      .orderBy(asc(category.position), asc(category.id))
      .for("update");
    const from = rows.findIndex((r) => r.id === id);
    if (from < 0) return { ok: false as const, reason: "not-found" as const };
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= rows.length) return { ok: false as const, reason: "edge" as const };
    [rows[from], rows[to]] = [rows[to], rows[from]];
    for (const [i, r] of rows.entries()) {
      if (r.position !== i)
        await tx.update(category).set({ position: i }).where(eq(category.id, r.id));
    }
    return { ok: true as const, position: to + 1 };
  });
}

type DeleteResult =
  | { ok: true }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "in-use"; total: number };

export async function deleteCategory(id: string): Promise<DeleteResult> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ id: category.id })
      .from(category)
      .where(eq(category.id, id))
      .for("update");
    if (!row) return { ok: false as const, reason: "not-found" as const };
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(post)
      .where(eq(post.categoryId, id));
    if (total > 0) return { ok: false as const, reason: "in-use" as const, total };
    await tx.delete(category).where(eq(category.id, id));
    return { ok: true as const };
  });
}
