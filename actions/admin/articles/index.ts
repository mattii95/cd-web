"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/actions/cuenta";
import {
  createPost,
  deletePost,
  getPostForEdit,
  setPostStatus,
  updatePost,
  type SavePostResult,
} from "@/db/admin-posts";
import {
  type ArticleField,
  type ArticleIntent,
  parseArticleForm,
  resultingStatus,
} from "@/lib/admin/article-form";
import { requireAdmin } from "@/lib/auth/dal";

const error = (message: string): FormState => ({ status: "error", message });

const MSG = {
  gone: "Ese artículo ya no existe.",
  stale: "Alguien modificó este artículo. Recargá para ver los cambios.",
  slugTaken: "Ya hay un artículo con esa URL.",
  missingMedia: "Una de las imágenes ya no está en Medios. Elegí otra.",
  db: "No pudimos guardar el cambio. Intentá de nuevo en unos minutos.",
};

// Un artículo que cambia de estado o se borra sale del blog público: se invalidan las dos cachés.
function invalidate(slug: string) {
  updateTag("blog");
  updateTag(`post:${slug}`);
  revalidatePath("/admin/articles");
}

async function run(
  data: FormData,
  op: (id: string) => Promise<{ slug: string; changed?: boolean } | null>,
  done: string,
): Promise<FormState> {
  await requireAdmin();
  const id = z.uuid().safeParse(data.get("id"));
  if (!id.success) return error(MSG.gone);

  try {
    const res = await op(id.data);
    if (!res) return error(MSG.gone);
    // Sin cambio (otra pestaña ya lo hizo): éxito sin invalidar nada.
    if (res.changed !== false) invalidate(res.slug);
    return { status: "success", message: done };
  } catch {
    return error(MSG.db);
  }
}

export async function publishPostAction(_: FormState, data: FormData): Promise<FormState> {
  return run(data, (id) => setPostStatus(id, "publicado"), "Artículo publicado.");
}

export async function unpublishPostAction(_: FormState, data: FormData): Promise<FormState> {
  return run(data, (id) => setPostStatus(id, "borrador"), "Artículo pasado a borrador.");
}

export async function deletePostAction(_: FormState, data: FormData): Promise<FormState> {
  return run(data, deletePost, "Artículo eliminado.");
}

export type ArticleFormState =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<ArticleField, string>>;
    }
  | {
      status: "success";
      message: string;
      id: string;
      slug: string;
      postStatus: "borrador" | "publicado";
      updatedAt: string; // ISO
    };

const SAVED: Record<ArticleIntent, string> = {
  draft: "Borrador guardado.",
  publish: "Artículo publicado.",
  unpublish: "Artículo pasado a borrador.",
  save: "Cambios guardados.",
};

const fail = (message: string): ArticleFormState => ({ status: "error", message });

export async function saveArticleAction(
  _: ArticleFormState,
  data: FormData,
): Promise<ArticleFormState> {
  const admin = await requireAdmin();

  try {
    const rawId = data.get("id");
    const id = typeof rawId === "string" && rawId ? rawId : null;
    // El estado guardado decide si "save" es estricto (publicado) o laxo (borrador).
    const current = id ? await getPostForEdit(id) : null;
    if (id && !current) return fail(MSG.gone);

    const parsed = parseArticleForm(data, current?.status ?? null);
    if (!parsed.ok) {
      return Object.keys(parsed.fieldErrors).length
        ? { status: "error", fieldErrors: parsed.fieldErrors }
        : fail(MSG.db);
    }

    const status = resultingStatus(parsed.intent, current?.status ?? null);
    let res: SavePostResult;
    if (!current) {
      res = await createPost(parsed.input, status, admin.id);
    } else if (!parsed.expectedUpdatedAt) {
      res = { ok: false, reason: "stale" };
    } else {
      res = await updatePost(current.id, parsed.input, status, parsed.expectedUpdatedAt);
    }

    if (!res.ok) {
      if (res.reason === "slug-taken")
        return { status: "error", fieldErrors: { slug: MSG.slugTaken } };
      if (res.reason === "missing-media") return fail(MSG.missingMedia);
      return fail(res.reason === "stale" ? MSG.stale : MSG.gone);
    }

    invalidate(res.slug);
    // "En uso en" de Medios depende de la portada y del cuerpo.
    revalidatePath("/admin/media");
    if (res.previousSlug) updateTag(`post:${res.previousSlug}`);
    return {
      status: "success",
      message: SAVED[parsed.intent],
      id: res.id,
      slug: res.slug,
      postStatus: status,
      updatedAt: res.updatedAt.toISOString(),
    };
  } catch {
    return fail(MSG.db);
  }
}
