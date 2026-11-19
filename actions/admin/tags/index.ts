"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/actions/cuenta";
import { createTag, deleteTag, mergeTags, searchTagOptions, updateTagRow } from "@/db/admin-tags";
import { requireAdmin } from "@/lib/auth/dal";
import { parseTagForm, type TagInput, type TaxonomyFormState } from "@/lib/admin/taxonomy-form";

const MSG = {
  created: "Etiqueta creada.",
  updated: "Etiqueta actualizada.",
  deleted: "Etiqueta borrada.",
  merged: (n: number, target: string) => `Listo: ${n} artículos pasaron a «${target}».`,
  slugTaken: "Ya hay una etiqueta con esa URL.",
  nameTaken: "Ya hay una etiqueta con ese nombre. Usá «Fusionar con…» para unirlas.",
  gone: "Esa etiqueta ya no existe.",
  same: "Elegí otra etiqueta.",
  db: "No pudimos guardar el cambio. Intentá de nuevo en unos minutos.",
};

const error = (message: string): FormState => ({ status: "error", message });

// Las etiquetas salen en el listado, en cada artículo y en los filtros.
function invalidate() {
  updateTag("blog");
  revalidatePath("/admin/tags");
  revalidatePath("/admin/articles");
}

export async function saveTagAction(
  _: TaxonomyFormState<TagInput>,
  data: FormData,
): Promise<TaxonomyFormState<TagInput>> {
  await requireAdmin();

  const parsed = parseTagForm(data);
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors };
  if (parsed.id !== null && !z.uuid().safeParse(parsed.id).success)
    return { status: "error", message: MSG.gone };

  try {
    const res = parsed.id ? await updateTagRow(parsed.id, parsed.input) : await createTag(parsed.input);
    if (!res.ok) {
      if (res.reason === "slug-taken") return { status: "error", fieldErrors: { slug: MSG.slugTaken } };
      if (res.reason === "name-taken") return { status: "error", fieldErrors: { name: MSG.nameTaken } };
      return { status: "error", message: MSG.gone };
    }
    invalidate();
    return { status: "success", message: parsed.id ? MSG.updated : MSG.created };
  } catch {
    return { status: "error", message: MSG.db };
  }
}

export async function deleteTagAction(_: FormState, data: FormData): Promise<FormState> {
  await requireAdmin();

  const id = z.uuid().safeParse(data.get("id"));
  if (!id.success) return error(MSG.gone);

  try {
    const res = await deleteTag(id.data);
    if (!res.ok) return error(MSG.gone);
    invalidate();
    return { status: "success", message: MSG.deleted };
  } catch {
    return error(MSG.db);
  }
}

const mergeSchema = z.object({ sourceId: z.uuid(), targetId: z.uuid() });

export async function mergeTagsAction(_: FormState, data: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = mergeSchema.safeParse({ sourceId: data.get("sourceId"), targetId: data.get("targetId") });
  if (!parsed.success) return error(MSG.gone);

  try {
    const res = await mergeTags(parsed.data.sourceId, parsed.data.targetId);
    if (!res.ok) return error(res.reason === "same" ? MSG.same : MSG.gone);
    invalidate();
    return { status: "success", message: MSG.merged(res.moved, res.target) };
  } catch {
    return error(MSG.db);
  }
}

const searchSchema = z.object({ query: z.string().max(100), excludeId: z.uuid() });

// Lectura para el combobox: no cambia nada, no invalida. Una entrada inválida no devuelve opciones.
export async function searchTagOptionsAction(
  input: { query: string; excludeId: string },
): Promise<{ id: string; name: string; total: number }[]> {
  await requireAdmin();
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return [];
  try {
    return await searchTagOptions(parsed.data.query, parsed.data.excludeId);
  } catch {
    return [];
  }
}
