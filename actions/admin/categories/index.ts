"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/actions/cuenta";
import {
  createCategory,
  deleteCategory,
  moveCategory,
  updateCategory,
} from "@/db/admin-categories";
import { requireAdmin } from "@/lib/auth/dal";
import {
  type CategoryInput,
  parseCategoryForm,
  type TaxonomyFormState,
} from "@/lib/admin/taxonomy-form";

const MSG = {
  created: "Categoría creada.",
  updated: "Categoría actualizada.",
  deleted: "Categoría borrada.",
  moved: "Orden actualizado.",
  slugTaken: "Ya hay una categoría con esa URL.",
  gone: "Esa categoría ya no existe.",
  edge: "La categoría ya está en ese extremo.",
  inUse: (n: number) => `No se puede borrar: tiene ${n} artículos.`,
  db: "No pudimos guardar el cambio. Intentá de nuevo en unos minutos.",
};

const error = (message: string): FormState => ({ status: "error", message });

// Categorías y etiquetas salen en el listado, en cada artículo y en los filtros.
function invalidate() {
  updateTag("blog");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/articles");
}

export async function saveCategoryAction(
  _: TaxonomyFormState<CategoryInput>,
  data: FormData,
): Promise<TaxonomyFormState<CategoryInput>> {
  await requireAdmin();

  const parsed = parseCategoryForm(data);
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors };
  if (parsed.id !== null && !z.uuid().safeParse(parsed.id).success)
    return { status: "error", message: MSG.gone };

  try {
    const res = parsed.id
      ? await updateCategory(parsed.id, parsed.input)
      : await createCategory(parsed.input);
    if (!res.ok) {
      return res.reason === "slug-taken"
        ? { status: "error", fieldErrors: { slug: MSG.slugTaken } }
        : { status: "error", message: MSG.gone };
    }
    invalidate();
    return { status: "success", message: parsed.id ? MSG.updated : MSG.created };
  } catch {
    return { status: "error", message: MSG.db };
  }
}

const moveSchema = z.object({ id: z.uuid(), direction: z.enum(["up", "down"]) });

export type MoveState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string; position: number }; // 1-based, para el aria-live

const moveError = (message: string): MoveState => ({ status: "error", message });

export async function moveCategoryAction(_: MoveState, data: FormData): Promise<MoveState> {
  await requireAdmin();

  const parsed = moveSchema.safeParse({ id: data.get("id"), direction: data.get("direction") });
  if (!parsed.success) return moveError(MSG.gone);

  try {
    const res = await moveCategory(parsed.data.id, parsed.data.direction);
    if (!res.ok) return moveError(res.reason === "edge" ? MSG.edge : MSG.gone);
    invalidate();
    return { status: "success", message: MSG.moved, position: res.position };
  } catch {
    return moveError(MSG.db);
  }
}

export async function deleteCategoryAction(_: FormState, data: FormData): Promise<FormState> {
  await requireAdmin();

  const id = z.uuid().safeParse(data.get("id"));
  if (!id.success) return error(MSG.gone);

  try {
    const res = await deleteCategory(id.data);
    if (!res.ok) {
      if (res.reason === "in-use") return error(MSG.inUse(res.total));
      return error(MSG.gone);
    }
    invalidate();
    return { status: "success", message: MSG.deleted };
  } catch {
    return error(MSG.db);
  }
}
